from __future__ import annotations

from datetime import datetime, timedelta, timezone
import asyncio
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException

from app.core.config import settings


# Scopes pedidos no OAuth — inclui Instagram para permitir leitura de perfil e mídia
META_SCOPES = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_read_user_content",
    "pages_manage_posts",
    "instagram_basic",
    "instagram_manage_insights",
    "instagram_content_publish",
    "instagram_manage_messages",
]

# Cache em memória do Instagram Business Account ID para evitar consultas repetidas
_ig_account_id_cache: str = ""


# Depois que o conteiner informa FINISHED, a Meta ainda leva um instante para a
# midia ficar publicavel. Publicar no mesmo segundo devolve 9007 ("Media ID is not
# available") com o status ja pronto, e a mensagem da propria Meta pede para
# aguardar. Esta e a espera que ela pede.
PUBLISH_SETTLE_SECONDS = 2.5

# As esperas da nova tentativa, em segundos. Somadas com a espera inicial dao 24
# segundos, que e o teto que ainda cabe numa publicacao feita com a pessoa
# olhando a tela. O agendamento automatico nao se incomoda com o tempo, mas quem
# clica em "Publicar agora" se incomoda.
PUBLISH_RETRY_WAITS = (3.0, 6.0, 12.0)

# O 9007 vem com `is_transient: false`, mas e transitorio: e a midia ainda
# processando do outro lado. O subcodigo 2207027 e a mesma coisa vista pelo
# caminho do story.
PUBLISH_NOT_READY = {9007}
PUBLISH_NOT_READY_SUBCODES = {2207027}


def _graph_error(response: httpx.Response) -> dict[str, Any]:
    """O bloco `error` da resposta, ou vazio quando nao ha JSON para ler."""
    try:
        payload = response.json()
    except ValueError:
        return {}
    erro = (payload or {}).get("error")
    return erro if isinstance(erro, dict) else {}


def _publish_error_detail(erro: dict[str, Any], o_que: str) -> str:
    """O erro de publicacao como frase, e nao como JSON.

    A ordem importa: os casos conhecidos primeiro, porque so eles dizem o que
    fazer. O `error_user_msg` da Meta vem depois, que e generico mas esta em
    portugues e foi escrito para ser lido. O codigo cru fica por ultimo, para a
    mensagem nunca sair vazia."""
    codigo = erro.get("code")
    subcodigo = erro.get("error_subcode")

    if codigo in {190, 102} or subcodigo in {463, 467}:
        return (
            "O token da Página expirou. Reconecte o Instagram em Marketing > Conexões "
            "antes de publicar."
        )
    if codigo == 9004 or subcodigo == 2207008:
        return (
            f"A Meta não conseguiu baixar a imagem {o_que}. A arte precisa estar numa "
            "URL pública: confira o armazenamento das peças em Conexões."
        )
    if subcodigo in {2207009, 2207010, 2207032} or codigo == 36003:
        return (
            f"A Meta recusou o formato da arte {o_que}. O feed aceita entre 4:5 e 1.91:1, "
            "e o story é 9:16."
        )
    if codigo == 25002 or subcodigo == 2207042:
        return (
            "A conta bateu o limite de publicações da Meta para as últimas 24 horas "
            "(25 por dia). A peça continua aprovada e pode ser publicada amanhã."
        )
    if codigo in PUBLISH_NOT_READY or subcodigo in PUBLISH_NOT_READY_SUBCODES:
        return (
            f"A Meta aceitou {o_que} mas não liberou a mídia dentro do tempo de espera. "
            "A peça não foi publicada e pode ser enviada de novo em alguns minutos."
        )

    humano = str(erro.get("error_user_msg") or "").strip()
    if humano:
        return f"A Meta recusou {o_que}: {humano}"
    mensagem = str(erro.get("message") or "").strip()
    if mensagem:
        return f"A Meta recusou {o_que}: {mensagem} (código {codigo})."
    return f"A Meta recusou {o_que} sem dizer o motivo."


class MetaMarketingService:
    def __init__(self) -> None:
        self.graph_version = settings.meta_graph_version or "v20.0"
        self.base_url = f"https://graph.facebook.com/{self.graph_version}"

    def _require_app(self) -> None:
        if not settings.meta_app_id or not settings.meta_app_secret:
            raise HTTPException(400, "Configure META_APP_ID e META_APP_SECRET no backend.")

    async def _page_token_async(self, page_id: str | None, page_access_token: str | None) -> tuple[str, str]:
        from app.services.token_store import aget as ts_aget
        target_page_id = page_id or await ts_aget("meta_page_id") or settings.meta_page_id
        token = page_access_token or await ts_aget("meta_page_access_token") or settings.meta_page_access_token or settings.meta_access_token
        if not target_page_id or not token:
            raise HTTPException(400, "Configure META_PAGE_ID e META_PAGE_ACCESS_TOKEN.")
        return target_page_id, token

    def _page_token(self, page_id: str | None, page_access_token: str | None) -> tuple[str, str]:
        from app.services.token_store import get as ts_get
        target_page_id = page_id or ts_get("meta_page_id") or settings.meta_page_id
        token = page_access_token or ts_get("meta_page_access_token") or settings.meta_page_access_token or settings.meta_access_token
        if not target_page_id or not token:
            raise HTTPException(400, "Configure META_PAGE_ID e META_PAGE_ACCESS_TOKEN.")
        return target_page_id, token

    # ─── OAuth ────────────────────────────────────────────────────────────────

    def auth_url(self, redirect_uri: str | None = None) -> str:
        self._require_app()
        target_redirect = redirect_uri or settings.meta_redirect_uri
        if not target_redirect:
            raise HTTPException(400, "Informe redirect_uri ou configure META_REDIRECT_URI.")
        params = {
            "client_id": settings.meta_app_id,
            "redirect_uri": target_redirect,
            "scope": ",".join(META_SCOPES),
            "response_type": "code",
        }
        return f"https://www.facebook.com/{self.graph_version}/dialog/oauth?{urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str | None = None) -> dict[str, Any]:
        self._require_app()
        target_redirect = redirect_uri or settings.meta_redirect_uri
        if not target_redirect:
            raise HTTPException(400, "Informe redirect_uri ou configure META_REDIRECT_URI.")
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                f"{self.base_url}/oauth/access_token",
                params={
                    "client_id": settings.meta_app_id,
                    "client_secret": settings.meta_app_secret,
                    "redirect_uri": target_redirect,
                    "code": code,
                },
            )
        if response.status_code >= 400:
            raise HTTPException(response.status_code, response.text)
        return response.json()

    async def list_pages(self, user_access_token: str) -> list[dict[str, Any]]:
        if not user_access_token:
            raise HTTPException(400, "Token de usuário ausente.")
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                f"{self.base_url}/me/accounts",
                params={
                    "access_token": user_access_token,
                    "fields": "id,name,category,access_token,tasks,instagram_business_account{id,username}",
                },
            )
        if response.status_code >= 400:
            raise HTTPException(response.status_code, response.text)
        return response.json().get("data", [])

    async def exchange_code_and_pages(self, code: str, redirect_uri: str | None = None) -> dict[str, Any]:
        token_payload = await self.exchange_code(code, redirect_uri)
        user_token = token_payload.get("access_token", "")
        pages = await self.list_pages(user_token)
        saved = await self._auto_save_page_token(user_token, pages)
        return {"user_access_token": user_token, "pages": pages, "auto_saved": saved}

    async def _auto_save_page_token(self, user_token: str, pages: list) -> bool:
        """Troca user token por long-lived page token e persiste (Supabase ou arquivo)."""
        from app.services.token_store import asave as ts_save
        try:
            # 1. Trocar user token curto por long-lived
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.get(
                    f"{self.base_url}/oauth/access_token",
                    params={
                        "grant_type": "fb_exchange_token",
                        "client_id": settings.meta_app_id,
                        "client_secret": settings.meta_app_secret,
                        "fb_exchange_token": user_token,
                    },
                )
            long_user = r.json().get("access_token", "")
            if not long_user:
                return

            # 2. Achar a página certa (usa meta_page_id do .env, ou a primeira)
            target_page = next(
                (p for p in pages if p.get("id") == settings.meta_page_id),
                pages[0] if pages else None,
            )
            if not target_page:
                return
            page_id = target_page["id"]

            # 3. Obter long-lived page token
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.get(
                    f"{self.base_url}/{page_id}",
                    params={"fields": "access_token", "access_token": long_user},
                )
            page_token = r.json().get("access_token", "")
            if not page_token:
                return

            # 4. Descobrir IG Business Account ID a partir da página (se ainda não tiver)
            ig_id = (
                target_page.get("instagram_business_account", {}).get("id", "")
                or settings.instagram_business_account_id
            )

            # 5. Persistir
            ts_save({
                "meta_page_id": page_id,
                "meta_page_access_token": page_token,
                "instagram_business_account_id": ig_id,
            })
            global _ig_account_id_cache
            if ig_id:
                _ig_account_id_cache = ig_id
            return True
        except Exception:
            # Fallback: salvar o token de curto prazo da página (expira em ~1-2h)
            try:
                from app.services.token_store import asave as ts_save_fb
                target_page = next(
                    (p for p in pages if p.get("id") == settings.meta_page_id),
                    pages[0] if pages else None,
                )
                if target_page and target_page.get("access_token"):
                    ig_id = target_page.get("instagram_business_account", {}).get("id", "") or settings.instagram_business_account_id
                    await ts_save_fb({
                        "meta_page_id": target_page["id"],
                        "meta_page_access_token": target_page["access_token"],
                        "instagram_business_account_id": ig_id,
                    })
                    return True
            except Exception:
                pass
            return False

    # ─── Facebook Page ─────────────────────────────────────────────────────────

    async def page_posts(
        self,
        page_id: str | None = None,
        page_access_token: str | None = None,
    ) -> list[dict[str, Any]]:
        target_page_id, token = self._page_token(page_id, page_access_token)
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                f"{self.base_url}/{target_page_id}/posts",
                params={
                    "access_token": token,
                    "fields": "message,created_time,full_picture,permalink_url,"
                              "likes.summary(true),comments.summary(true)",
                    "limit": 30,
                },
            )
        if response.status_code >= 400:
            raise HTTPException(response.status_code, response.text)
        return response.json().get("data", [])

    async def page_insights_full(
        self,
        page_id: str | None = None,
        page_access_token: str | None = None,
    ) -> dict[str, Any]:
        target_page_id, token = self._page_token(page_id, page_access_token)
        now = datetime.now(timezone.utc)
        since = now - timedelta(days=57)
        async with httpx.AsyncClient(timeout=30) as client:
            insights_resp = await client.get(
                f"{self.base_url}/{target_page_id}/insights",
                params={
                    "access_token": token,
                    "metric": "page_impressions,page_post_engagements",
                    "period": "day",
                    "since": int(since.timestamp()),
                    "until": int(now.timestamp()),
                },
            )
            fans_resp = await client.get(
                f"{self.base_url}/{target_page_id}",
                params={"access_token": token, "fields": "fan_count"},
            )
        if insights_resp.status_code >= 400:
            raise HTTPException(insights_resp.status_code, insights_resp.text)
        data = insights_resp.json().get("data", [])
        fans_data = fans_resp.json() if fans_resp.status_code < 400 else {}
        daily: dict[str, dict[str, int]] = {}
        for item in data:
            name = item["name"]
            for v in item.get("values", []):
                day = v["end_time"][:10]
                if day not in daily:
                    daily[day] = {"alcance": 0, "engajamento": 0}
                if name == "page_impressions":
                    daily[day]["alcance"] = int(v["value"])
                elif name == "page_post_engagements":
                    daily[day]["engajamento"] = int(v["value"])
        today = now.date()
        weekly = []
        for weeks_ago in range(7, -1, -1):
            week_end = today - timedelta(days=weeks_ago * 7)
            week_start = week_end - timedelta(days=6)
            label = week_end.strftime("%d/%m")
            weekly.append({
                "week": label,
                "alcance": sum(daily.get(str(week_start + timedelta(days=d)), {}).get("alcance", 0) for d in range(7)),
                "engajamento": sum(daily.get(str(week_start + timedelta(days=d)), {}).get("engajamento", 0) for d in range(7)),
            })
        total_impressions = sum(v.get("alcance", 0) for v in daily.values())
        total_engagements = sum(v.get("engajamento", 0) for v in daily.values())
        first_half = sum(w["alcance"] for w in weekly[:4])
        second_half = sum(w["alcance"] for w in weekly[4:])
        trend_pct = round(((second_half - first_half) / first_half * 100) if first_half > 0 else 0, 1)
        return {
            "weekly": weekly,
            "summary": {
                "impressions_total": total_impressions,
                "engagements_total": total_engagements,
                "fans": fans_data.get("fan_count", 0),
                "trend_pct": trend_pct,
                "engagement_rate": round(
                    (total_engagements / total_impressions * 100) if total_impressions > 0 else 0, 2
                ),
            },
        }

    # Kept for backwards compat
    async def page_insights(self, page_id: str | None = None, page_access_token: str | None = None) -> dict[str, Any]:
        return await self.page_insights_full(page_id, page_access_token)

    # ─── Instagram Business Account ────────────────────────────────────────────

    async def get_instagram_account_id(self) -> str:
        global _ig_account_id_cache
        from app.services.token_store import aget as ts_aget
        if settings.instagram_business_account_id:
            return settings.instagram_business_account_id
        stored_ig = await ts_aget("instagram_business_account_id")
        if stored_ig:
            return stored_ig
        if _ig_account_id_cache:
            return _ig_account_id_cache
        target_page_id, token = await self._page_token_async(None, None)
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{self.base_url}/{target_page_id}",
                params={"access_token": token, "fields": "instagram_business_account"},
            )
        if r.status_code >= 400:
            raise HTTPException(
                400,
                "Não foi possível obter o Instagram Business Account ID. "
                "Configure INSTAGRAM_BUSINESS_ACCOUNT_ID no .env ou vincule o Instagram à página no Facebook.",
            )
        ig_id = r.json().get("instagram_business_account", {}).get("id", "")
        if not ig_id:
            raise HTTPException(
                400,
                "Nenhuma conta Instagram Business vinculada à página Facebook. "
                "Acesse Configurações da Página → Instagram e vincule a conta.",
            )
        _ig_account_id_cache = ig_id
        return ig_id

    async def instagram_profile(self) -> dict[str, Any]:
        ig_id = await self.get_instagram_account_id()
        _, token = await self._page_token_async(None, None)
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{self.base_url}/{ig_id}",
                params={
                    "access_token": token,
                    "fields": "id,name,username,biography,website,followers_count,media_count,profile_picture_url",
                },
            )
        if r.status_code >= 400:
            raise HTTPException(r.status_code, r.text)
        return r.json()

    async def instagram_media(self, limit: int = 30) -> list[dict[str, Any]]:
        """As publicacoes mais recentes, paginando ate atingir `limit`.

        A versao anterior pedia uma pagina de 30 e parava ali. Isso bastava para
        a vitrine de posts, mas falseava a esteira: com mais de 30 publicacoes em
        30 dias, "posts por semana" virava piso em vez de medida, e a comparacao
        com os concorrentes saia errada para baixo."""
        ig_id = await self.get_instagram_account_id()
        _, token = await self._page_token_async(None, None)
        fields = (
            "id,caption,media_type,media_product_type,"
            "media_url,thumbnail_url,permalink,timestamp,"
            "like_count,comments_count"
        )
        collected: list[dict[str, Any]] = []
        url = f"{self.base_url}/{ig_id}/media"
        params: dict[str, Any] = {"access_token": token, "fields": fields, "limit": min(limit, 100)}

        async with httpx.AsyncClient(timeout=30) as client:
            # Teto de paginas para um perfil com milhares de posts nao virar uma
            # sequencia longa de chamadas a cada abertura da tela.
            for _ in range(6):
                r = await client.get(url, params=params)
                if r.status_code >= 400:
                    raise HTTPException(r.status_code, r.text)
                payload = r.json()
                collected.extend(payload.get("data", []))
                nxt = (payload.get("paging") or {}).get("next")
                if not nxt or len(collected) >= limit:
                    break
                # O link de proxima pagina ja traz token e cursor embutidos.
                url, params = nxt, {}
        return collected[:limit]

    async def business_discovery(self, username: str, media_limit: int = 24) -> dict[str, Any]:
        """Dados públicos de outro perfil Instagram Business/Creator, pela Business
        Discovery do Graph. É a via oficial e sem custo extra de olhar concorrente:
        usa o mesmo token da conta já conectada e não depende de raspagem.

        Não funciona para perfil pessoal nem para conta privada, e devolve só o que
        é público — seguidores, publicações e o engajamento visível de cada post.
        Nada de alcance ou impressões: insight de terceiro a Meta não entrega."""
        handle = username.strip().lstrip("@")
        if not handle:
            raise HTTPException(422, "Informe o @ do perfil a ser analisado.")
        ig_id = await self.get_instagram_account_id()
        _, token = await self._page_token_async(None, None)
        media_fields = (
            "id,caption,media_type,media_product_type,permalink,timestamp,"
            "like_count,comments_count"
        )
        fields = (
            f"business_discovery.username({handle})"
            "{id,username,name,biography,website,followers_count,follows_count,"
            f"media_count,profile_picture_url,media.limit({media_limit}){{{media_fields}}}}}"
        )
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                f"{self.base_url}/{ig_id}",
                params={"access_token": token, "fields": fields},
            )
        if r.status_code >= 400:
            raise HTTPException(r.status_code, _business_discovery_error(r, handle))
        discovery = r.json().get("business_discovery")
        if not discovery:
            raise HTTPException(
                404,
                f"O Instagram nao devolveu dados de @{handle}. Confirme se a conta existe "
                "e se e do tipo Comercial ou Criador de conteudo.",
            )
        return discovery

    async def _await_container(
        self,
        client: httpx.AsyncClient,
        token: str,
        container_id: str,
        o_que: str,
    ) -> None:
        """Espera o conteiner terminar de processar do lado da Meta."""
        for _ in range(10):
            status = await client.get(
                f"{self.base_url}/{container_id}",
                params={"access_token": token, "fields": "status_code,status"},
            )
            payload = status.json() if status.status_code < 400 else {}
            status_code = payload.get("status_code")
            if status_code == "FINISHED":
                return
            if status_code in {"ERROR", "EXPIRED"}:
                raise HTTPException(
                    502,
                    f"A Meta não processou a arte {o_que}: {payload.get('status', status_code)}",
                )
            await asyncio.sleep(2)
        raise HTTPException(
            504,
            f"A Meta demorou para processar a arte {o_que}. Tente novamente em instantes.",
        )

    async def _publish_container(
        self,
        client: httpx.AsyncClient,
        ig_id: str,
        token: str,
        container_id: str,
        o_que: str,
    ) -> str:
        """Publica o conteiner pronto e devolve o id da midia.

        A espera antes da primeira tentativa, e a nova tentativa em 9007, existem
        porque FINISHED nao significa publicavel: a Meta libera a midia um
        instante depois, e e esse instante que derrubava o story."""
        await asyncio.sleep(PUBLISH_SETTLE_SECONDS)

        for espera in (0.0, *PUBLISH_RETRY_WAITS):
            if espera:
                await asyncio.sleep(espera)
            published = await client.post(
                f"{self.base_url}/{ig_id}/media_publish",
                data={"access_token": token, "creation_id": container_id},
            )
            if published.status_code < 400:
                return str(published.json().get("id", ""))

            erro = _graph_error(published)
            ainda_processando = (
                erro.get("code") in PUBLISH_NOT_READY
                or erro.get("error_subcode") in PUBLISH_NOT_READY_SUBCODES
            )
            if not ainda_processando:
                raise HTTPException(published.status_code, _publish_error_detail(erro, o_que))

        raise HTTPException(504, _publish_error_detail({"code": 9007}, o_que))

    async def publish_instagram_image(self, image_url: str, caption: str) -> dict[str, str]:
        """Publica uma imagem aprovada. O agendamento permanece sob controle do ERP."""
        ig_id = await self.get_instagram_account_id()
        _, token = await self._page_token_async(None, None)
        async with httpx.AsyncClient(timeout=90.0) as client:
            created = await client.post(
                f"{self.base_url}/{ig_id}/media",
                data={"access_token": token, "image_url": image_url, "caption": caption},
            )
            if created.status_code >= 400:
                raise HTTPException(created.status_code, f"Meta recusou a arte: {created.text[:300]}")
            container_id = created.json().get("id", "")
            if not container_id:
                raise HTTPException(502, "A Meta não retornou o contêiner da publicação.")

            await self._await_container(client, token, container_id, "da publicação")
            media_id = await self._publish_container(client, ig_id, token, container_id, "a publicação")
        return {"container_id": container_id, "media_id": media_id}

    async def publish_instagram_story(self, image_url: str) -> dict[str, str]:
        """Publica um Story — a API da Meta nao aceita legenda para media_type=STORIES."""
        ig_id = await self.get_instagram_account_id()
        _, token = await self._page_token_async(None, None)
        async with httpx.AsyncClient(timeout=90.0) as client:
            created = await client.post(
                f"{self.base_url}/{ig_id}/media",
                data={"access_token": token, "image_url": image_url, "media_type": "STORIES"},
            )
            if created.status_code >= 400:
                raise HTTPException(created.status_code, f"Meta recusou o story: {created.text[:300]}")
            container_id = created.json().get("id", "")
            if not container_id:
                raise HTTPException(502, "A Meta não retornou o contêiner do story.")

            await self._await_container(client, token, container_id, "do story")
            media_id = await self._publish_container(client, ig_id, token, container_id, "o story")
        return {"container_id": container_id, "media_id": media_id}

    async def publish_facebook_image(self, image_url: str, caption: str) -> str:
        page_id, token = await self._page_token_async(None, None)
        async with httpx.AsyncClient(timeout=40.0) as client:
            response = await client.post(
                f"{self.base_url}/{page_id}/photos",
                data={"access_token": token, "url": image_url, "caption": caption, "published": "true"},
            )
        if response.status_code >= 400:
            raise HTTPException(response.status_code, f"Falha ao publicar no Facebook: {response.text[:300]}")
        return response.json().get("post_id") or response.json().get("id", "")

    async def instagram_account_insights(self) -> dict[str, Any]:
        ig_id = await self.get_instagram_account_id()
        _, token = await self._page_token_async(None, None)
        now = datetime.now(timezone.utc)
        # API v20+: reach com period=day suporta até 30 dias; impressions foi removido
        since = now - timedelta(days=30)

        async with httpx.AsyncClient(timeout=30) as client:
            profile_r = await client.get(
                f"{self.base_url}/{ig_id}",
                params={"access_token": token, "fields": "followers_count,media_count"},
            )
            # Usar apenas reach (única métrica diária válida na v20+)
            insights_r = await client.get(
                f"{self.base_url}/{ig_id}/insights",
                params={
                    "access_token": token,
                    "metric": "reach",
                    "period": "day",
                    "since": int(since.timestamp()),
                    "until": int(now.timestamp()),
                },
            )

        profile = profile_r.json() if profile_r.status_code < 400 else {}
        insights_ok = insights_r.status_code < 400
        data = insights_r.json().get("data", []) if insights_ok else []

        daily: dict[str, int] = {}
        for item in data:
            if item["name"] == "reach":
                for v in item.get("values", []):
                    daily[v["end_time"][:10]] = int(v["value"])

        today = now.date()
        weekly = []
        for weeks_ago in range(3, -1, -1):
            week_end = today - timedelta(days=weeks_ago * 7)
            week_start = week_end - timedelta(days=6)
            label = week_end.strftime("%d/%m")
            weekly.append({
                "week": label,
                "alcance": sum(daily.get(str(week_start + timedelta(days=d)), 0) for d in range(7)),
            })

        total_reach = sum(daily.values())
        first_half = sum(w["alcance"] for w in weekly[:2])
        second_half = sum(w["alcance"] for w in weekly[2:])
        trend_pct = round(((second_half - first_half) / first_half * 100) if first_half > 0 else 0, 1)

        return {
            "weekly": weekly,
            "insights_available": insights_ok,
            "summary": {
                "followers": profile.get("followers_count", 0),
                "media_count": profile.get("media_count", 0),
                "reach_total": total_reach,
                "impressions_total": 0,
                "profile_views_total": 0,
                "trend_pct": trend_pct,
            },
        }


    async def instagram_follower_growth(self) -> dict[str, Any]:
        """Daily follower count history (requires instagram_manage_insights)."""
        ig_id = await self.get_instagram_account_id()
        _, token = await self._page_token_async(None, None)
        now = datetime.now(timezone.utc)

        async with httpx.AsyncClient(timeout=15) as client:
            profile_r = await client.get(
                f"{self.base_url}/{ig_id}",
                params={"access_token": token, "fields": "followers_count"},
            )
            insights_r = await client.get(
                f"{self.base_url}/{ig_id}/insights",
                params={
                    "access_token": token,
                    "metric": "follower_count",
                    "period": "day",
                    "since": int((now - timedelta(days=30)).timestamp()),
                    "until": int(now.timestamp()),
                },
            )

        current = profile_r.json().get("followers_count", 0) if profile_r.status_code < 400 else 0
        body = insights_r.json()

        if insights_r.status_code >= 400 or "error" in body:
            return {"available": False, "current_followers": current}

        data = body.get("data", [])
        values = data[0].get("values", []) if data else []
        # follower_count com period=day retorna novos seguidores por dia (net)
        daily = [{"date": v["end_time"][:10], "novos": int(v["value"])} for v in values]
        growth_30d = sum(int(v["value"]) for v in values)

        return {
            "available": True,
            "current_followers": current,
            "daily": daily,
            "growth_30d": growth_30d,
        }

    async def instagram_messages(self) -> dict[str, Any]:
        """Instagram DM conversations (requires instagram_manage_messages + Meta App Review)."""
        ig_id = await self.get_instagram_account_id()
        _, token = await self._page_token_async(None, None)

        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{self.base_url}/{ig_id}/conversations",
                params={
                    "access_token": token,
                    "platform": "instagram",
                    "fields": "participants,messages{message,from,created_time},updated_time",
                },
            )

        body = r.json()
        if r.status_code >= 400 or "error" in body:
            return {
                "available": False,
                "reason": body.get("error", {}).get(
                    "message",
                    "Permissão instagram_manage_messages necessária — requer aprovação da Meta.",
                ),
            }

        conversations = body.get("data", [])
        return {"available": True, "total": len(conversations), "conversations": conversations}


def _business_discovery_error(response: httpx.Response, handle: str) -> str:
    """A Meta responde com a mesma mensagem genérica para casos bem diferentes.
    Sem traduzir aqui, a tela mostraria 'Invalid parameter' e ninguém saberia que
    o problema é a conta do concorrente ser pessoal em vez de comercial."""
    message = ""
    user_message = ""
    subcode = 0
    try:
        error = response.json().get("error", {}) or {}
        message = str(error.get("message", ""))
        user_message = str(error.get("error_user_msg", ""))
        subcode = int(error.get("error_subcode") or 0)
    except (AttributeError, TypeError, ValueError):
        pass
    lowered = message.lower()
    # O @ que nao existe chega como "Invalid user id", subcode 2207013 e
    # is_transient false. Precisa casar aqui: nenhum dos padroes antigos pega essa
    # frase, e o fallback mandava "tente novamente em instantes" — o conselho errado,
    # porque insistir num @ inexistente nunca resolve. Confirmado contra a Meta em
    # 16/11/2026, conferindo 31 handles do setor de ponto.
    if (
        subcode == 2207013
        or "invalid user id" in lowered
        or "does not exist" in lowered
        or "cannot be loaded" in lowered
        or "invalid parameter" in lowered
    ):
        return (
            f"Nao foi possivel ler @{handle}. A Business Discovery so enxerga perfil "
            "Comercial ou Criador de conteudo, publico e existente. Confira o @ no "
            "proprio Instagram, porque tentar de novo nao resolve."
        )
    if "permission" in lowered or "oauth" in lowered:
        return "A conexao com a Meta perdeu a permissao de leitura. Reconecte em Marketing > Conexoes."
    if response.status_code == 429 or "limit" in lowered:
        return "O limite de chamadas da Meta foi atingido. Tente de novo mais tarde."
    # Quando a Meta manda texto pronto para o usuario, ele diz mais que o generico.
    if user_message:
        return user_message
    return f"Nao foi possivel ler @{handle} agora. Tente novamente em instantes."


def mask_token(token: str) -> str:
    if not token:
        return ""
    if len(token) <= 12:
        return "***"
    return f"{token[:6]}...{token[-4:]}"
