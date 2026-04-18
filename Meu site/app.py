import json
import os
from flask import Flask, render_template, request, redirect, url_for
from datetime import datetime, timedelta

app = Flask(__name__)
# Nome do arquivo de dados para esta versão
NOME_ARQUIVO = "contratos_v4.json"

def carregar_contratos():
    if os.path.exists(NOME_ARQUIVO):
        with open(NOME_ARQUIVO, "r") as f:
            return json.load(f)
    return []

def salvar_contratos(dados):
    with open(NOME_ARQUIVO, "w") as f:
        json.dump(dados, f, indent=4)

def gerar_fluxo(valor_p, taxa_m, prazo, data_inicio):
    fluxo = []
    saldo_devedor = valor_p
    taxa_decimal = taxa_m / 100
    
    # Cálculo PMT (Price)
    if taxa_decimal > 0:
        pmt = valor_p * (taxa_decimal * (1 + taxa_decimal)**prazo) / ((1 + taxa_decimal)**prazo - 1)
    else:
        pmt = valor_p / prazo

    data_atual = datetime.strptime(data_inicio, '%Y-%m-%d')

    for i in range(1, prazo + 1):
        juros = saldo_devedor * taxa_decimal
        amortizacao = pmt - juros
        saldo_devedor -= amortizacao
        
        fluxo.append({
            "n": i,
            "data_sort": data_atual.strftime('%Y-%m-%d'),
            "data_tela": data_atual.strftime('%d/%m/%Y'),
            "parcela": round(pmt, 2),
            "juros": round(juros, 2),
            "amortizacao": round(amortizacao, 2),
            "saldo": round(max(saldo_devedor, 0), 2)
        })
        
        # Lógica para próximo mês
        mes = data_atual.month % 12 + 1
        ano = data_atual.year + (1 if data_atual.month == 12 else 0)
        try:
            data_atual = data_atual.replace(year=ano, month=mes)
        except ValueError:
            data_atual = (data_atual.replace(day=1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)

    return fluxo

@app.route("/", methods=["GET", "POST"])
def index():
    contratos = carregar_contratos()
    view = request.args.get('view', 'lista')
    
    # Filtros de data padrão (mês atual)
    hoje = datetime.now()
    d_ini = request.args.get('data_ini', hoje.replace(day=1).strftime('%Y-%m-%d'))
    d_fim = request.args.get('data_fim', (hoje.replace(day=1) + timedelta(days=32)).replace(day=1).strftime('%Y-%m-%d'))

    if request.method == "POST":
        valor = float(request.form.get("valor", 0))
        taxa = float(request.form.get("taxa", 0))
        prazo = int(request.form.get("prazo", 1))
        data_1 = request.form.get("data_primeira")
        
        fluxo_detalhado = gerar_fluxo(valor, taxa, prazo, data_1)
        
        novo_contrato = {
            "id": int(datetime.now().timestamp()),
            "modalidade": request.form.get("modalidade"),
            "banco": request.form.get("banco"),
            "valor_principal": valor,
            "taxa_mensal": taxa,
            "prazo": prazo,
            "parcela": fluxo_detalhado[0]['parcela'],
            "total_final": round(fluxo_detalhado[0]['parcela'] * prazo, 2),
            "fluxo": fluxo_detalhado
        }
        contratos.append(novo_contrato)
        salvar_contratos(contratos)
        return redirect(url_for('index', view='lista'))

    # Relatório de Fluxo por Período
    resumo = {"principal": 0, "juros": 0, "total": 0}
    for c in contratos:
        for p in c['fluxo']:
            if d_ini <= p['data_sort'] <= d_fim:
                resumo["principal"] += p['amortizacao']
                resumo["juros"] += p['juros']
                resumo["total"] += p['parcela']

    return render_template("emprestimos.html", 
                           contratos=contratos, view=view, 
                           resumo=resumo, d_ini=d_ini, d_fim=d_fim)

@app.route("/excluir/<int:contrato_id>")
def excluir(contrato_id):
    contratos = carregar_contratos()
    contratos = [c for c in contratos if c.get('id') != contrato_id]
    salvar_contratos(contratos)
    return redirect(url_for('index', view='lista'))

if __name__ == "__main__":
    app.run(debug=True, port=8001)