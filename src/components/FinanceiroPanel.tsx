import { useMemo, useState } from 'react'
import { formatValorNfe, formatPesoBruto, formatQuantidadeNfe } from '../lib/formatNfeItem'
import {
  formatMoedaFinanceiro,
  formatarCnpj,
  formatarDataBr,
  formatarDataHoraBr,
  normalizarCnpj,
  resumirClienteFinanceiro,
  resumirNfArmazenada,
} from '../lib/financeiro/calculo'
import { contratoAtivoCliente, tabelaById } from '../lib/financeiro/clientes'
import type {
  CicloCobranca,
  ClienteFinanceiro,
  ContratoCliente,
  FinanceiroData,
  RegraTempo,
  TabelaCobranca,
} from '../lib/financeiro/types'
import type { MovimentoRegistro, NotaFiscal } from '../types'

type SubAba = 'tabela' | 'contrato' | 'clientes' | 'entrada'

type Props = {
  data: FinanceiroData
  notas: NotaFiscal[]
  movimentos: MovimentoRegistro[]
  loading: boolean
  saving: boolean
  error: string | null
  onUpdate: (updater: (prev: FinanceiroData) => FinanceiroData) => void
  onSaveNow: () => Promise<void>
}

const SUBABAS: { id: SubAba; label: string }[] = [
  { id: 'tabela', label: 'Tabela de cobrança' },
  { id: 'contrato', label: 'Contrato' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'entrada', label: 'Data de entrada' },
]

function parseNum(raw: string): number {
  const n = Number(raw.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function FinanceiroPanel({
  data,
  notas,
  movimentos,
  loading,
  saving,
  error,
  onUpdate,
  onSaveNow,
}: Props) {
  const [subAba, setSubAba] = useState<SubAba>('tabela')
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null)

  const resumoCliente = useMemo(() => {
    if (!clienteSelecionado) return null
    const cli = data.clientes.find((c) => c.cnpj === clienteSelecionado)
    if (!cli) return null
    const contrato = contratoAtivoCliente(data, cli.cnpj)
    const tabela = tabelaById(data, contrato?.tabelaId ?? null)
    return resumirClienteFinanceiro(cli.cnpj, cli.razaoSocial, contrato, tabela, notas, movimentos)
  }, [clienteSelecionado, data, notas, movimentos])

  if (loading) {
    return (
      <div className="financeiro-panel">
        <p className="muted">Carregando financeiro…</p>
      </div>
    )
  }

  return (
    <div className="financeiro-panel">
      <p className="muted">
        Cobrança de armazenagem por cliente: cadastre tabelas de preço, contratos e acompanhe o
        tempo de permanência das NFs.
      </p>

      {error && <p className="error">{error}</p>}
      {saving && <p className="muted fin-saving">Salvando…</p>}

      <div className="fin-subabas" role="tablist">
        {SUBABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            className={`fin-subaba ${subAba === a.id ? 'fin-subaba--active' : ''}`}
            aria-selected={subAba === a.id}
            onClick={() => setSubAba(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {subAba === 'tabela' && (
        <TabelaCobrancaSection data={data} onUpdate={onUpdate} onSaveNow={onSaveNow} />
      )}
      {subAba === 'contrato' && (
        <ContratoSection data={data} onUpdate={onUpdate} onSaveNow={onSaveNow} />
      )}
      {subAba === 'clientes' && (
        <ClientesSection
          data={data}
          resumoCliente={resumoCliente}
          clienteSelecionado={clienteSelecionado}
          onSelectCliente={setClienteSelecionado}
          onUpdate={onUpdate}
          onSaveNow={onSaveNow}
        />
      )}
      {subAba === 'entrada' && (
        <DataEntradaSection
          data={data}
          notas={notas}
          movimentos={movimentos}
          onSelectCliente={(cnpj) => {
            setClienteSelecionado(cnpj)
            setSubAba('clientes')
          }}
        />
      )}
    </div>
  )
}

/* ─── Tabela de cobrança ─── */

function TabelaCobrancaSection({
  data,
  onUpdate,
  onSaveNow,
}: {
  data: FinanceiroData
  onUpdate: Props['onUpdate']
  onSaveNow: Props['onSaveNow']
}) {
  const [editId, setEditId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [cPosicao, setCPosicao] = useState('')
  const [cKilo, setCKilo] = useState('')
  const [cPalete, setCPalete] = useState('')
  const [cEntrada, setCEntrada] = useState('')
  const [cSaida, setCSaida] = useState('')

  function resetForm() {
    setEditId(null)
    setNome('')
    setCPosicao('')
    setCKilo('')
    setCPalete('')
    setCEntrada('')
    setCSaida('')
  }

  function loadEdit(t: TabelaCobranca) {
    setEditId(t.id)
    setNome(t.nome)
    setCPosicao(String(t.custoPosicaoPalete))
    setCKilo(String(t.custoPorKilo))
    setCPalete(String(t.custoPorPalete))
    setCEntrada(String(t.custoEntrada))
    setCSaida(String(t.custoSaida))
  }

  function handleSalvar() {
    const trimmed = nome.trim()
    if (!trimmed) return
    const tabela: TabelaCobranca = {
      id: editId ?? newId('tab'),
      nome: trimmed,
      custoPosicaoPalete: parseNum(cPosicao),
      custoPorKilo: parseNum(cKilo),
      custoPorPalete: parseNum(cPalete),
      custoEntrada: parseNum(cEntrada),
      custoSaida: parseNum(cSaida),
      criadoEm: editId
        ? (data.tabelas.find((t) => t.id === editId)?.criadoEm ?? new Date().toISOString())
        : new Date().toISOString(),
    }
    onUpdate((prev) => ({
      ...prev,
      tabelas: editId
        ? prev.tabelas.map((t) => (t.id === editId ? tabela : t))
        : [tabela, ...prev.tabelas],
    }))
    resetForm()
    void onSaveNow()
  }

  function handleExcluir(id: string) {
    onUpdate((prev) => ({
      ...prev,
      tabelas: prev.tabelas.filter((t) => t.id !== id),
    }))
    if (editId === id) resetForm()
    void onSaveNow()
  }

  return (
    <div className="fin-section">
      <div className="sidebar-block">
        <h4>{editId ? 'Editar tabela' : 'Nova tabela de cobrança'}</h4>
        <label className="nf-itens-campo">
          <span>Nome da tabela</span>
          <input type="text" className="input-nf" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Padrão congelados" />
        </label>
        <div className="fin-grid-2">
          <label className="nf-itens-campo">
            <span>Custo por posição palete (R$)</span>
            <input type="text" className="input-nf" value={cPosicao} onChange={(e) => setCPosicao(e.target.value)} placeholder="0,00" />
          </label>
          <label className="nf-itens-campo">
            <span>Custo por quilo (R$)</span>
            <input type="text" className="input-nf" value={cKilo} onChange={(e) => setCKilo(e.target.value)} placeholder="0,00" />
          </label>
          <label className="nf-itens-campo">
            <span>Custo por palete (R$)</span>
            <input type="text" className="input-nf" value={cPalete} onChange={(e) => setCPalete(e.target.value)} placeholder="0,00" />
          </label>
          <label className="nf-itens-campo">
            <span>Custo de entrada (R$)</span>
            <input type="text" className="input-nf" value={cEntrada} onChange={(e) => setCEntrada(e.target.value)} placeholder="0,00" />
          </label>
          <label className="nf-itens-campo">
            <span>Custo de saída (R$)</span>
            <input type="text" className="input-nf" value={cSaida} onChange={(e) => setCSaida(e.target.value)} placeholder="0,00" />
          </label>
        </div>
        <div className="fin-actions">
          <button type="button" className="btn primary" onClick={handleSalvar} disabled={!nome.trim()}>
            {editId ? 'Atualizar' : 'Cadastrar tabela'}
          </button>
          {editId && (
            <button type="button" className="btn" onClick={resetForm}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      {data.tabelas.length > 0 && (
        <div className="sidebar-block">
          <h4>Tabelas cadastradas ({data.tabelas.length})</h4>
          <ul className="fin-lista">
            {data.tabelas.map((t) => (
              <li key={t.id} className="fin-lista-item">
                <div className="fin-lista-main">
                  <strong>{t.nome}</strong>
                  <span className="muted fin-lista-detalhe">
                    Posição {formatMoedaFinanceiro(t.custoPosicaoPalete)} · Kilo{' '}
                    {formatMoedaFinanceiro(t.custoPorKilo)} · Palete{' '}
                    {formatMoedaFinanceiro(t.custoPorPalete)} · Entrada{' '}
                    {formatMoedaFinanceiro(t.custoEntrada)} · Saída{' '}
                    {formatMoedaFinanceiro(t.custoSaida)}
                  </span>
                </div>
                <div className="fin-lista-btns">
                  <button type="button" className="btn btn-sm" onClick={() => loadEdit(t)}>
                    Editar
                  </button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => handleExcluir(t.id)}>
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ─── Contrato ─── */

function ContratoSection({
  data,
  onUpdate,
  onSaveNow,
}: {
  data: FinanceiroData
  onUpdate: Props['onUpdate']
  onSaveNow: Props['onSaveNow']
}) {
  const [editId, setEditId] = useState<string | null>(null)
  const [cnpj, setCnpj] = useState('')
  const [razao, setRazao] = useState('')
  const [tabelaId, setTabelaId] = useState('')
  const [ciclo, setCiclo] = useState<CicloCobranca>('mensal')
  const [regraTempo, setRegraTempo] = useState<RegraTempo>('proporcional')
  const [cobPosicao, setCobPosicao] = useState(false)
  const [cobKilo, setCobKilo] = useState(false)
  const [cobPalete, setCobPalete] = useState(false)
  const [cobEntrada, setCobEntrada] = useState(false)
  const [cobSaida, setCobSaida] = useState(false)
  const [kiloPorDia, setKiloPorDia] = useState(false)
  const [obs, setObs] = useState('')

  function resetForm() {
    setEditId(null)
    setCnpj('')
    setRazao('')
    setTabelaId('')
    setCiclo('mensal')
    setRegraTempo('proporcional')
    setCobPosicao(false)
    setCobKilo(false)
    setCobPalete(false)
    setCobEntrada(false)
    setCobSaida(false)
    setKiloPorDia(false)
    setObs('')
  }

  function loadEdit(c: ContratoCliente) {
    setEditId(c.id)
    setCnpj(c.cnpj)
    setRazao(c.razaoSocial)
    setTabelaId(c.tabelaId ?? '')
    setCiclo(c.ciclo)
    setRegraTempo(c.regraTempo)
    setCobPosicao(c.cobrarPosicaoPalete)
    setCobKilo(c.cobrarKilo)
    setCobPalete(c.cobrarPalete)
    setCobEntrada(c.cobrarEntrada)
    setCobSaida(c.cobrarSaida)
    setKiloPorDia(c.kiloPorDia)
    setObs(c.observacao ?? '')
  }

  function handleSelectCliente(cnpjKey: string) {
    const cli = data.clientes.find((c) => c.cnpj === cnpjKey)
    if (cli) {
      setCnpj(cli.cnpj)
      setRazao(cli.razaoSocial)
    }
  }

  function handleSalvar() {
    const cnpjNorm = normalizarCnpj(cnpj) || cnpj.trim()
    const razaoTrim = razao.trim()
    if (!cnpjNorm || !razaoTrim) return

    const contrato: ContratoCliente = {
      id: editId ?? newId('ctr'),
      cnpj: cnpjNorm,
      razaoSocial: razaoTrim,
      tabelaId: tabelaId || null,
      ciclo,
      regraTempo,
      cobrarPosicaoPalete: cobPosicao,
      cobrarKilo: cobKilo,
      cobrarPalete: cobPalete,
      cobrarEntrada: cobEntrada,
      cobrarSaida: cobSaida,
      kiloPorDia,
      ativo: true,
      ...(obs.trim() ? { observacao: obs.trim() } : {}),
      criadoEm: editId
        ? (data.contratos.find((c) => c.id === editId)?.criadoEm ?? new Date().toISOString())
        : new Date().toISOString(),
    }

    onUpdate((prev) => {
      const clientes = prev.clientes.some((c) => c.cnpj === cnpjNorm)
        ? prev.clientes
        : [
            {
              cnpj: cnpjNorm,
              razaoSocial: razaoTrim,
              origem: 'manual' as const,
              criadoEm: new Date().toISOString(),
            },
            ...prev.clientes,
          ]
      return {
        ...prev,
        clientes,
        contratos: editId
          ? prev.contratos.map((c) => (c.id === editId ? contrato : c))
          : [contrato, ...prev.contratos],
      }
    })
    resetForm()
    void onSaveNow()
  }

  function handleExcluir(id: string) {
    onUpdate((prev) => ({
      ...prev,
      contratos: prev.contratos.filter((c) => c.id !== id),
    }))
    if (editId === id) resetForm()
    void onSaveNow()
  }

  return (
    <div className="fin-section">
      <div className="sidebar-block">
        <h4>{editId ? 'Editar contrato' : 'Novo contrato de armazenagem'}</h4>

        {data.clientes.length > 0 && (
          <label className="nf-itens-campo">
            <span>Cliente cadastrado</span>
            <select
              className="input-nf"
              value=""
              onChange={(e) => {
                if (e.target.value) handleSelectCliente(e.target.value)
              }}
            >
              <option value="">Selecionar cliente…</option>
              {data.clientes.map((c) => (
                <option key={c.cnpj} value={c.cnpj}>
                  {c.razaoSocial} {c.cnpj.startsWith('nome:') ? '' : `(${formatarCnpj(c.cnpj)})`}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="fin-grid-2">
          <label className="nf-itens-campo">
            <span>CNPJ</span>
            <input type="text" className="input-nf" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
          </label>
          <label className="nf-itens-campo">
            <span>Razão social</span>
            <input type="text" className="input-nf" value={razao} onChange={(e) => setRazao(e.target.value)} />
          </label>
        </div>

        <label className="nf-itens-campo">
          <span>Tabela de cobrança</span>
          <select className="input-nf" value={tabelaId} onChange={(e) => setTabelaId(e.target.value)}>
            <option value="">Nenhuma (definir depois)</option>
            {data.tabelas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>

        <div className="fin-grid-2">
          <fieldset className="fin-fieldset">
            <legend>Ciclo de cobrança</legend>
            <label className="fin-check">
              <input type="radio" name="fin-ciclo" checked={ciclo === 'mensal'} onChange={() => setCiclo('mensal')} />
              Mensal
            </label>
            <label className="fin-check">
              <input type="radio" name="fin-ciclo" checked={ciclo === 'quinzenal'} onChange={() => setCiclo('quinzenal')} />
              Quinzenal
            </label>
          </fieldset>

          <fieldset className="fin-fieldset">
            <legend>Regra de tempo</legend>
            <label className="fin-check">
              <input type="radio" name="fin-regra" checked={regraTempo === 'proporcional'} onChange={() => setRegraTempo('proporcional')} />
              Proporcional (por dias)
            </label>
            <label className="fin-check">
              <input type="radio" name="fin-regra" checked={regraTempo === 'cheia'} onChange={() => setRegraTempo('cheia')} />
              Cheia (período inteiro)
            </label>
          </fieldset>
        </div>

        <fieldset className="fin-fieldset fin-cobrancas">
          <legend>O que cobrar</legend>
          <div className="fin-check-grid">
            <label className="fin-check">
              <input type="checkbox" checked={cobPosicao} onChange={(e) => setCobPosicao(e.target.checked)} />
              Posição palete
            </label>
            <label className="fin-check">
              <input type="checkbox" checked={cobKilo} onChange={(e) => setCobKilo(e.target.checked)} />
              Por quilo
            </label>
            <label className="fin-check">
              <input type="checkbox" checked={cobPalete} onChange={(e) => setCobPalete(e.target.checked)} />
              Por palete
            </label>
            <label className="fin-check">
              <input type="checkbox" checked={cobEntrada} onChange={(e) => setCobEntrada(e.target.checked)} />
              Entrada
            </label>
            <label className="fin-check">
              <input type="checkbox" checked={cobSaida} onChange={(e) => setCobSaida(e.target.checked)} />
              Saída
            </label>
            <label className="fin-check fin-check--sub">
              <input type="checkbox" checked={kiloPorDia} onChange={(e) => setKiloPorDia(e.target.checked)} disabled={!cobKilo} />
              Kilo × dias armazenados
            </label>
          </div>
        </fieldset>

        <label className="nf-itens-campo">
          <span>Observação</span>
          <input type="text" className="input-nf" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
        </label>

        <div className="fin-actions">
          <button type="button" className="btn primary" onClick={handleSalvar} disabled={!cnpj.trim() || !razao.trim()}>
            {editId ? 'Atualizar contrato' : 'Cadastrar contrato'}
          </button>
          {editId && (
            <button type="button" className="btn" onClick={resetForm}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      {data.contratos.length > 0 && (
        <div className="sidebar-block">
          <h4>Contratos ({data.contratos.length})</h4>
          <ul className="fin-lista">
            {data.contratos.map((c) => {
              const tab = data.tabelas.find((t) => t.id === c.tabelaId)
              const flags = [
                c.cobrarPosicaoPalete && 'Posição',
                c.cobrarKilo && (c.kiloPorDia ? 'Kilo×dia' : 'Kilo'),
                c.cobrarPalete && 'Palete',
                c.cobrarEntrada && 'Entrada',
                c.cobrarSaida && 'Saída',
              ].filter(Boolean)
              return (
                <li key={c.id} className="fin-lista-item">
                  <div className="fin-lista-main">
                    <strong>{c.razaoSocial}</strong>
                    <span className="muted">
                      {c.cnpj.startsWith('nome:') ? c.cnpj.slice(5) : formatarCnpj(c.cnpj)}
                    </span>
                    <span className="muted fin-lista-detalhe">
                      {c.ciclo === 'quinzenal' ? 'Quinzenal' : 'Mensal'} ·{' '}
                      {c.regraTempo === 'cheia' ? 'Cheia' : 'Proporcional'}
                      {tab ? ` · ${tab.nome}` : ''}
                      {flags.length ? ` · ${flags.join(', ')}` : ''}
                    </span>
                  </div>
                  <div className="fin-lista-btns">
                    <button type="button" className="btn btn-sm" onClick={() => loadEdit(c)}>
                      Editar
                    </button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => handleExcluir(c.id)}>
                      Excluir
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ─── Clientes cadastrados ─── */

function ClientesSection({
  data,
  resumoCliente,
  clienteSelecionado,
  onSelectCliente,
  onUpdate,
  onSaveNow,
}: {
  data: FinanceiroData
  resumoCliente: ReturnType<typeof resumirClienteFinanceiro> | null
  clienteSelecionado: string | null
  onSelectCliente: (cnpj: string | null) => void
  onUpdate: Props['onUpdate']
  onSaveNow: Props['onSaveNow']
}) {
  const [cnpjManual, setCnpjManual] = useState('')
  const [razaoManual, setRazaoManual] = useState('')

  function handleCadastrarManual() {
    const cnpjNorm = normalizarCnpj(cnpjManual) || cnpjManual.trim()
    const razao = razaoManual.trim()
    if (!cnpjNorm || !razao) return
    if (data.clientes.some((c) => c.cnpj === cnpjNorm)) return

    const novo: ClienteFinanceiro = {
      cnpj: cnpjNorm,
      razaoSocial: razao,
      origem: 'manual',
      criadoEm: new Date().toISOString(),
    }
    onUpdate((prev) => ({ ...prev, clientes: [novo, ...prev.clientes] }))
    setCnpjManual('')
    setRazaoManual('')
    void onSaveNow()
  }

  return (
    <div className="fin-section">
      <div className="sidebar-block">
        <h4>Cadastrar cliente manualmente</h4>
        <div className="fin-grid-2">
          <label className="nf-itens-campo">
            <span>CNPJ</span>
            <input type="text" className="input-nf" value={cnpjManual} onChange={(e) => setCnpjManual(e.target.value)} />
          </label>
          <label className="nf-itens-campo">
            <span>Razão social</span>
            <input type="text" className="input-nf" value={razaoManual} onChange={(e) => setRazaoManual(e.target.value)} />
          </label>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={handleCadastrarManual}
          disabled={!cnpjManual.trim() || !razaoManual.trim()}
        >
          Cadastrar
        </button>
        <p className="muted fin-hint">Clientes também são cadastrados automaticamente ao dar entrada de NF.</p>
      </div>

      <div className="sidebar-block">
        <h4>Clientes cadastrados ({data.clientes.length})</h4>
        {data.clientes.length === 0 ? (
          <p className="muted">Nenhum cliente ainda. Dê entrada de uma NF ou cadastre manualmente.</p>
        ) : (
          <ul className="fin-lista">
            {data.clientes.map((c) => (
              <li key={c.cnpj}>
                <button
                  type="button"
                  className={`fin-cliente-btn ${clienteSelecionado === c.cnpj ? 'fin-cliente-btn--active' : ''}`}
                  onClick={() => onSelectCliente(clienteSelecionado === c.cnpj ? null : c.cnpj)}
                >
                  <strong>{c.razaoSocial}</strong>
                  <span className="muted">
                    {c.cnpj.startsWith('nome:') ? 'Sem CNPJ no XML' : formatarCnpj(c.cnpj)}
                    {' · '}
                    {c.origem === 'auto' ? 'Auto' : 'Manual'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {resumoCliente && (
        <div className="sidebar-block fin-cliente-detalhe">
          <h4>{resumoCliente.razaoSocial}</h4>
          {!resumoCliente.contrato && (
            <p className="muted fin-aviso">Sem contrato ativo — cadastre um contrato para calcular cobranças.</p>
          )}

          <div className="fin-resumo-cards">
            <article className="fin-resumo-card">
              <span className="muted">NFs armazenadas</span>
              <strong>{resumoCliente.nfsArmazenadas.length}</strong>
            </article>
            <article className="fin-resumo-card">
              <span className="muted">NFs finalizadas</span>
              <strong>{resumoCliente.nfsFinalizadas.length}</strong>
            </article>
            <article className="fin-resumo-card fin-resumo-card--destaque">
              <span className="muted">Total a cobrar</span>
              <strong>{formatMoedaFinanceiro(resumoCliente.totalGeral)}</strong>
            </article>
          </div>

          {resumoCliente.nfsArmazenadas.length > 0 && (
            <>
              <h5>Notas em armazenagem</h5>
              <ul className="fin-nf-lista">
                {resumoCliente.nfsArmazenadas.map((nf) => {
                  const cob = resumoCliente.cobrancas.find((c) => c.nfId === nf.nfId)
                  return (
                    <li key={nf.nfId} className="fin-nf-item">
                      <div className="fin-nf-header">
                        <strong>NF {nf.nfNumero}</strong>
                        <span className="fin-badge fin-badge--ativo">Armazenada</span>
                      </div>
                      <div className="fin-nf-stats muted">
                        Entrada {formatarDataBr(nf.dataEntrada)} · {nf.diasArmazenados} dias ·{' '}
                        {formatPesoBruto(nf.pesoLiquido)} kg · {nf.totalItens} itens ·{' '}
                        {formatQuantidadeNfe(nf.totalCaixas)} CX · {nf.totalPaletes} paletes
                      </div>
                      {cob && cob.detalhes.length > 0 && (
                        <ul className="fin-cobranca-detalhes">
                          {cob.detalhes.map((d, i) => (
                            <li key={i}>
                              {d.label}: <strong>{formatMoedaFinanceiro(d.valor)}</strong>
                            </li>
                          ))}
                          <li className="fin-cobranca-total">
                            Total NF: <strong>{formatMoedaFinanceiro(cob.total)}</strong>
                          </li>
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {resumoCliente.nfsFinalizadas.length > 0 && (
            <>
              <h5>Notas finalizadas (saída concluída)</h5>
              <ul className="fin-nf-lista">
                {resumoCliente.nfsFinalizadas.map((nf) => {
                  const cob = resumoCliente.cobrancas.find((c) => c.nfId === nf.nfId)
                  return (
                    <li key={nf.nfId} className="fin-nf-item fin-nf-item--finalizada">
                      <div className="fin-nf-header">
                        <strong>NF {nf.nfNumero}</strong>
                        <span className="fin-badge fin-badge--finalizada">Finalizada</span>
                      </div>
                      <div className="fin-nf-stats muted">
                        {formatarDataBr(nf.dataEntrada)} →{' '}
                        {nf.dataSaida ? formatarDataBr(nf.dataSaida) : '—'} · {nf.diasArmazenados} dias ·{' '}
                        {formatPesoBruto(nf.pesoLiquido)} kg
                      </div>
                      {cob && (
                        <div className="fin-cobranca-total muted">
                          Cobrança final: <strong>{formatMoedaFinanceiro(cob.total)}</strong>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {resumoCliente.nfsArmazenadas.length === 0 && resumoCliente.nfsFinalizadas.length === 0 && (
            <p className="muted">Nenhuma NF vinculada a este cliente.</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Data de entrada ─── */

function DataEntradaSection({
  data,
  notas,
  movimentos,
  onSelectCliente,
}: {
  data: FinanceiroData
  notas: NotaFiscal[]
  movimentos: MovimentoRegistro[]
  onSelectCliente: (cnpj: string) => void
}) {
  const [filtroCliente, setFiltroCliente] = useState('')

  const resumos = useMemo(
    () => notas.map((nf) => resumirNfArmazenada(nf, movimentos)),
    [notas, movimentos],
  )

  const filtrados = useMemo(() => {
    if (!filtroCliente) return resumos
    return resumos.filter((r) => {
      const cnpj = r.emitenteCnpj ? normalizarCnpj(r.emitenteCnpj) : ''
      return cnpj === filtroCliente || r.emitente.trim().toLowerCase().includes(filtroCliente.toLowerCase())
    })
  }, [resumos, filtroCliente])

  return (
    <div className="fin-section">
      <div className="sidebar-block">
        <h4>Controle de permanência</h4>
        <p className="muted">
          Data de entrada, tempo armazenado, peso, caixas e itens por NF. Ao dar saída, a cobrança
          é finalizada.
        </p>

        {data.clientes.length > 0 && (
          <label className="nf-itens-campo">
            <span>Filtrar por cliente</span>
            <select className="input-nf" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
              <option value="">Todos os clientes</option>
              {data.clientes.map((c) => (
                <option key={c.cnpj} value={c.cnpj}>
                  {c.razaoSocial}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {filtrados.length === 0 ? (
        <p className="muted">Nenhuma NF encontrada.</p>
      ) : (
        <ul className="fin-nf-lista">
          {filtrados.map((nf) => {
            const cli = data.clientes.find((c) => {
              const cnpj = nf.emitenteCnpj ? normalizarCnpj(nf.emitenteCnpj) : ''
              return c.cnpj === cnpj || c.razaoSocial.trim().toLowerCase() === nf.emitente.trim().toLowerCase()
            })
            return (
              <li key={nf.nfId} className="fin-nf-item">
                <div className="fin-nf-header">
                  <strong>NF {nf.nfNumero}</strong>
                  <span className={`fin-badge ${nf.status === 'armazenada' ? 'fin-badge--ativo' : 'fin-badge--finalizada'}`}>
                    {nf.status === 'armazenada' ? 'Armazenada' : 'Finalizada'}
                  </span>
                </div>
                <div className="fin-nf-stats">
                  <span>{nf.emitente}</span>
                  {cli && (
                    <button type="button" className="btn-link fin-link-cliente" onClick={() => onSelectCliente(cli.cnpj)}>
                      Ver cliente →
                    </button>
                  )}
                </div>
                <div className="fin-entrada-grid">
                  <div>
                    <span className="muted">Entrada</span>
                    <strong>{formatarDataHoraBr(nf.dataEntrada)}</strong>
                  </div>
                  <div>
                    <span className="muted">Saída</span>
                    <strong>{nf.dataSaida ? formatarDataHoraBr(nf.dataSaida) : '—'}</strong>
                  </div>
                  <div>
                    <span className="muted">Dias</span>
                    <strong>{nf.diasArmazenados}</strong>
                  </div>
                  <div>
                    <span className="muted">Peso</span>
                    <strong>{formatPesoBruto(nf.pesoLiquido)} kg</strong>
                  </div>
                  <div>
                    <span className="muted">Itens</span>
                    <strong>{nf.totalItens}</strong>
                  </div>
                  <div>
                    <span className="muted">Caixas</span>
                    <strong>{formatQuantidadeNfe(nf.totalCaixas)}</strong>
                  </div>
                  <div>
                    <span className="muted">Paletes</span>
                    <strong>{nf.totalPaletes}</strong>
                  </div>
                  <div>
                    <span className="muted">Valor merc.</span>
                    <strong>{formatValorNfe(nf.valorMercadoria)}</strong>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
