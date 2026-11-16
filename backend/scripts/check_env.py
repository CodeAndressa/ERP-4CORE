"""Confere o .env da maquina e diz o que falta, sem subir o servidor.

    python backend/scripts/check_env.py

Mesma fonte de verdade da tela Sistema > Ambiente: os dois leem GROUPS de
env_status_service.py, entao terminal e tela nunca discordam.

Nenhum valor e impresso, so se a variavel esta preenchida.
"""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.env_status_service import env_status  # noqa: E402

VERDE = "\033[32m"
AMARELO = "\033[33m"
CINZA = "\033[90m"
NEGRITO = "\033[1m"
FIM = "\033[0m"


def main() -> int:
    status = env_status()
    print(f"\n{NEGRITO}Ambiente: {status['environment']}{FIM}")
    print(f"{status['ready_count']} de {status['total_count']} grupos prontos\n")

    for group in status["groups"]:
        marca = f"{VERDE}[ok]{FIM}" if group["ready"] else f"{AMARELO}[falta]{FIM}"
        print(f"{marca} {NEGRITO}{group['name']}{FIM}")
        print(f"      {CINZA}{group['unlocks']}{FIM}")
        for variable in group["variables"]:
            if variable["filled"]:
                print(f"      {VERDE}v{FIM} {variable['name']}")
            elif variable["required"]:
                print(f"      {AMARELO}!{FIM} {variable['name']}")
            else:
                print(f"      {CINZA}- {variable['name']} (opcional){FIM}")
        if not group["ready"]:
            print(f"      {CINZA}onde pegar: {group['where']}{FIM}")
        if group["note"]:
            print(f"      {CINZA}{group['note']}{FIM}")
        print()

    if status["all_ready"]:
        print(f"{VERDE}Tudo configurado.{FIM}\n")
        return 0

    destino = "painel da Vercel" if status["is_production"] else ".env na raiz do projeto"
    print(f"{AMARELO}Preencha o que falta no {destino}.{FIM}\n")
    # Sai com 1 para o comando poder ser usado em verificacao automatica.
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
