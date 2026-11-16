from sqlalchemy import Boolean, Column, DateTime, Float, Index, Integer, String, Text
from sqlalchemy.sql import func

from app.database.session import Base


class MarketingContent(Base):
    __tablename__ = "marketing_content"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(180), nullable=False)
    brief = Column(Text, nullable=False, default="")
    caption = Column(Text, nullable=False, default="")
    # Frase que foi desenhada na arte. Sem guardar isso o texto visível do story
    # ficava irrecuperável depois de gerar, e tanto o feedback quanto a próxima
    # versão precisam saber o que estava escrito lá.
    headline = Column(String(200), nullable=False, default="")
    image_prompt = Column(Text, nullable=False, default="")
    # O que foi pedido de ajuste nesta peça, acumulado. Vale só para ela: o
    # aprendizado que vale para todos os stories mora em MarketingArtFeedback.
    revision_notes = Column(Text, nullable=False, default="")
    channel = Column(String(30), nullable=False, default="instagram")
    format = Column(String(30), nullable=False, default="image")
    layout = Column(String(20), nullable=False, default="feed")
    status = Column(String(40), nullable=False, default="draft", index=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    art_path = Column(String(500), nullable=False, default="")
    meta_container_id = Column(String(180), nullable=False, default="")
    instagram_media_id = Column(String(180), nullable=False, default="")
    facebook_post_id = Column(String(180), nullable=False, default="")
    error_message = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class MarketingArtFeedback(Base):
    """Feedback da equipe sobre uma arte de story já gerada. É a matéria-prima do
    aprendizado: cada registro entra no prompt das gerações seguintes, então um
    "não gostei do fundo azulado" passa a valer para todos os stories futuros, e
    não só para a peça em que foi escrito.

    aspects guarda as tags marcadas na tela (imagem, cores, texto, tom,
    legibilidade, marca) separadas por vírgula — é o que decide se a lição vai
    para o prompt da imagem ou para o prompt da redação."""

    __tablename__ = "marketing_art_feedback"

    id = Column(Integer, primary_key=True, index=True)
    content_id = Column(Integer, nullable=False, index=True)
    sentiment = Column(String(10), nullable=False, default="disliked")
    aspects = Column(String(200), nullable=False, default="")
    notes = Column(Text, nullable=False, default="")
    headline = Column(String(200), nullable=False, default="")
    image_prompt = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class MarketingArtLesson(Base):
    """Destilação do feedback acumulado em regras curtas. Existe por dois motivos:
    o prompt não pode crescer para sempre conforme o histórico aumenta, e feedbacks
    contraditórios ("escurece mais" em março, "clareia o rosto" em junho) precisam
    ser resolvidos em uma regra só, em vez de despejar os dois no modelo.

    feedback_count é a marca d'água: quantos feedbacks já estavam destilados nesta
    versão. Serve para redestilar só quando entrou feedback novo o suficiente."""

    __tablename__ = "marketing_art_lesson"

    id = Column(Integer, primary_key=True, index=True)
    copy_rules = Column(Text, nullable=False, default="")
    image_rules = Column(Text, nullable=False, default="")
    feedback_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class InstagramMessage(Base):
    """Log local das DMs do Instagram — alimentado pelo webhook (inbound) e pelo envio
    de respostas pelo ERP (outbound). O Graph API é a fonte de verdade das conversas;
    esta tabela existe pra sobreviver a picos/atraso de entrega do webhook e pra dar
    contagem de "novas mensagens" sem precisar repolling constante."""

    __tablename__ = "instagram_messages"
    __table_args__ = (Index("ix_instagram_messages_mid_unique", "mid", unique=True),)

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(String(64), nullable=False, index=True)
    sender_id = Column(String(64), nullable=False, default="")
    sender_username = Column(String(120), nullable=False, default="")
    direction = Column(String(10), nullable=False, default="inbound")
    text = Column(Text, nullable=False, default="")
    mid = Column(String(160), nullable=False, default="")
    seen_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class ExternalScheduledPost(Base):
    """Registro manual de posts agendados fora do ERP (ex.: composer do Meta
    Business Suite). A Meta não expõe via Graph API o que foi agendado pelo
    Business Suite para apps de terceiros — isso só existe pra dar visibilidade
    no Calendário, não dispara publicação nenhuma (é só um lembrete visual)."""

    __tablename__ = "external_scheduled_posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(180), nullable=False)
    channel = Column(String(30), nullable=False, default="instagram")
    # Post de feed ou story, igual ao layout de MarketingContent. Sem isso o
    # Calendário não conseguiria colorir um agendamento externo, e a distinção
    # entre post e story ficaria valendo só para metade das peças.
    layout = Column(String(20), nullable=False, default="feed")
    scheduled_at = Column(DateTime(timezone=True), nullable=False, index=True)
    notes = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class MarketingCompetitor(Base):
    """Perfil de Instagram que o agente observa. Só entra aqui conta Business ou
    Creator: a Business Discovery da Meta não enxerga perfil pessoal, e é ela que
    alimenta esta tabela sem custo e sem raspagem."""

    __tablename__ = "marketing_competitors"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(120), nullable=False, unique=True, index=True)
    display_name = Column(String(180), nullable=False, default="")
    notes = Column(Text, nullable=False, default="")
    active = Column(Boolean, nullable=False, default=True)
    followers_count = Column(Integer, nullable=False, default=0)
    follows_count = Column(Integer, nullable=False, default=0)
    media_count = Column(Integer, nullable=False, default=0)
    biography = Column(Text, nullable=False, default="")
    profile_picture_url = Column(String(600), nullable=False, default="")
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class CompetitorPost(Base):
    """Post público de um concorrente. media_id é único porque a sincronização roda
    de novo sobre as mesmas publicações — o que muda entre uma rodada e outra são as
    curtidas e os comentários, então a linha é atualizada, não duplicada."""

    __tablename__ = "marketing_competitor_posts"
    __table_args__ = (Index("ix_competitor_posts_media_unique", "media_id", unique=True),)

    id = Column(Integer, primary_key=True, index=True)
    competitor_id = Column(Integer, nullable=False, index=True)
    media_id = Column(String(120), nullable=False, default="")
    media_type = Column(String(30), nullable=False, default="")
    media_product_type = Column(String(30), nullable=False, default="")
    caption = Column(Text, nullable=False, default="")
    permalink = Column(String(600), nullable=False, default="")
    like_count = Column(Integer, nullable=False, default=0)
    comments_count = Column(Integer, nullable=False, default=0)
    posted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    synced_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CompetitorSnapshot(Base):
    """Uma foto de seguidores/publicações por sincronização. A Business Discovery só
    devolve o número de hoje; o crescimento ao longo do tempo só existe se a gente
    guardar a série aqui."""

    __tablename__ = "marketing_competitor_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    competitor_id = Column(Integer, nullable=False, index=True)
    followers_count = Column(Integer, nullable=False, default=0)
    media_count = Column(Integer, nullable=False, default=0)
    captured_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class MarketingAgentRun(Base):
    """Uma rodada do agente: o que ele observou, o que concluiu e o que criou.
    O payload fica em JSON porque o diagnóstico muda de forma conforme o prompt
    evolui — normalizar isso em colunas obrigaria migração a cada ajuste de texto."""

    __tablename__ = "marketing_agent_runs"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String(20), nullable=False, default="running", index=True)
    trigger = Column(String(20), nullable=False, default="manual")
    benchmark_json = Column(Text, nullable=False, default="")
    diagnosis_json = Column(Text, nullable=False, default="")
    created_content_ids = Column(String(300), nullable=False, default="")
    error_message = Column(Text, nullable=False, default="")
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)


class MarketingAgentStep(Base):
    """Um passo da esteira: qual agente rodou, quanto demorou e quanto custou.

    É uma linha por agente por rodada, e não um JSON dentro de MarketingAgentRun,
    porque o painel de custos precisa somar por agente e por período. Guardar isso
    como texto obrigaria a reprocessar o histórico inteiro a cada consulta."""

    __tablename__ = "marketing_agent_steps"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, nullable=False, index=True)
    # A peça que este passo produziu, quando ele produz uma. Os passos de analise
    # valem para a rodada inteira e ficam sem conteudo associado.
    content_id = Column(Integer, nullable=True, index=True)
    agent = Column(String(40), nullable=False, index=True)
    sequence = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="running")
    provider = Column(String(30), nullable=False, default="")
    model = Column(String(120), nullable=False, default="")
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    images = Column(Integer, nullable=False, default=0)
    cost_usd = Column(Float, nullable=False, default=0.0)
    # Falso quando o custo saiu da tabela de precos em vez de vir do provedor.
    cost_measured = Column(Boolean, nullable=False, default=False)
    duration_ms = Column(Integer, nullable=False, default=0)
    summary = Column(Text, nullable=False, default="")
    error_message = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
