#!/bin/bash
# Inicia o servidor local e abre o navegador
cd /Users/jessemisaeldepaula/Documents

# Matar processo anterior na porta 8080 se houver
lsof -ti:8080 | xargs kill -9 2>/dev/null
sleep 1

echo "╔════════════════════════════════════╗"
echo "║   JMP Finance — Servidor Local     ║"
echo "║   Iniciando...                     ║"
echo "╚════════════════════════════════════╝"

# Iniciar servidor em background
python3 -m http.server 8080 &
SERVER_PID=$!

# Aguardar servidor responder
echo "Aguardando servidor..."
until curl -s http://localhost:8080 > /dev/null 2>&1; do
  sleep 0.5
done

echo "Servidor pronto! Abrindo navegador..."
open http://localhost:8080/DRE/login.html

echo "╔════════════════════════════════════╗"
echo "║   JMP Finance — Servidor rodando   ║"
echo "║   http://localhost:8080            ║"
echo "║   Mantenha esta janela aberta      ║"
echo "║   Feche para encerrar              ║"
echo "╚════════════════════════════════════╝"

# Manter aberto
wait $SERVER_PID
