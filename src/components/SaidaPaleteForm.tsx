import { useMemo } from 'react'
import type { AddressId, NotaFiscal } from '../types'
import {
  calcularSaidaPalete,
  caixasJaSaidasItem,
  caixasPorPalete,
  parseQuantidadeSaida,
  type SaidaPaleteCalculo,
  type SaidaPaleteDraft,
} from '../lib/saidaParcial'
import { formatAddressLabel } from '../layout/camaras'
import { formatPesoBruto, formatQuantidadeNfe, formatValorNfe } from '../lib/formatNfeItem'

type Props = {
  nf: NotaFiscal
  modoPalete: boolean
  qtdPaletesInput: string
  qtdPaletesAlvo: number | null
  paletesDisponiveis: number
  paletesSelecionados: AddressId[]
  selecaoConcluida: boolean
  paleteAtivo: AddressId | null
  caixasInput: string
  paletesConfirmados: SaidaPaleteDraft[]
  onQtdPaletesChange: (value: string) => void
  onIniciarSelecao: () => void
  onConfirmarSelecaoPaletes: () => void
  onCaixasChange: (value: string) => void
  onConfirmarPalete: () => void
  onRemoverPalete: (addressId: AddressId) => void
  selecaoErro: string | null
}

export function SaidaPaleteForm({
  nf,
  modoPalete,
  qtdPaletesInput,
  qtdPaletesAlvo,
  paletesDisponiveis,
  paletesSelecionados,
  selecaoConcluida,
  paleteAtivo,
  caixasInput,
  paletesConfirmados,
  onQtdPaletesChange,
  onIniciarSelecao,
  onConfirmarSelecaoPaletes,
  onCaixasChange,
  onConfirmarPalete,
  onRemoverPalete,
  selecaoErro,
}: Props) {
  const itemAtivo = useMemo(() => {
    if (!paleteAtivo) return null
    return nf.items.find((it) => it.allocatedAddresses.includes(paleteAtivo)) ?? null
  }, [nf.items, paleteAtivo])

  const caixas = parseQuantidadeSaida(caixasInput)
  const calc: SaidaPaleteCalculo | null = useMemo(() => {
    if (!itemAtivo || !paleteAtivo || caixas == null || caixas <= 0) return null
    return calcularSaidaPalete(nf, itemAtivo, paleteAtivo, caixas, paletesConfirmados)
  }, [nf, itemAtivo, paleteAtivo, caixas, paletesConfirmados])

  const maxCaixas = itemAtivo
    ? itemAtivo.quantidade - caixasJaSaidasItem(itemAtivo.index, paletesConfirmados)
    : 0

  const totais = paletesConfirmados.reduce(
    (acc, p) => {
      const item = nf.items.find((it) => it.index === p.itemIndex)
      if (!item) return acc
      const c = calcularSaidaPalete(nf, item, p.addressId, p.quantidadeCaixas, [])
      return {
        caixas: acc.caixas + p.quantidadeCaixas,
        pesoBruto: acc.pesoBruto + (c?.pesoBrutoSaida ?? 0),
        pesoLiquido: acc.pesoLiquido + (c?.pesoLiquidoSaida ?? 0),
        valor: acc.valor + (c?.valorTotalSaida ?? 0),
      }
    },
    { caixas: 0, pesoBruto: 0, pesoLiquido: 0, valor: 0 },
  )

  const qtdInputValida = useMemo(() => {
    const n = Number(qtdPaletesInput.trim().replace(',', '.'))
    return Number.isFinite(n) && n > 0 && Math.floor(n) === n
  }, [qtdPaletesInput])

  const selecaoCompleta =
    qtdPaletesAlvo != null && paletesSelecionados.length === qtdPaletesAlvo

  if (!modoPalete || (qtdPaletesAlvo == null && !selecaoConcluida)) {
    return (
      <div className="saida-paletes-form">
        <label className="consulta-campo">
          <span>Quantidade de paletes</span>
          <input
            type="number"
            min={1}
            max={paletesDisponiveis}
            step={1}
            className="input-nf"
            value={qtdPaletesInput}
            onChange={(e) => onQtdPaletesChange(e.target.value)}
            placeholder="0"
          />
        </label>
        <p className="muted saida-paletes-disponiveis">
          {paletesDisponiveis} palete(s) disponível(is) neste item
          {paletesConfirmados.length > 0 && (
            <> · {paletesConfirmados.length} já confirmado(s)</>
          )}
        </p>
        {selecaoErro && <p className="error">{selecaoErro}</p>}
        <button
          type="button"
          className="btn primary full"
          disabled={!qtdInputValida || paletesDisponiveis <= 0}
          onClick={onIniciarSelecao}
        >
          {paletesConfirmados.length > 0 ? 'Selecionar mais paletes' : 'Selecionar paletes no painel'}
        </button>

        {paletesConfirmados.length > 0 && (
          <div className="saida-paletes-confirmados">
            <p className="nf-section-title nf-section-title--sm">Paletes na saída</p>
            <ul className="saida-paletes-lista">
              {paletesConfirmados.map((p) => {
                const item = nf.items.find((it) => it.index === p.itemIndex)
                const c =
                  item && calcularSaidaPalete(nf, item, p.addressId, p.quantidadeCaixas, [])
                return (
                  <li key={p.addressId} className="saida-palete-item">
                    <div>
                      <strong>{formatAddressLabel(p.addressId)}</strong>
                      <span className="muted">
                        {' '}
                        · {formatQuantidadeNfe(p.quantidadeCaixas)} {item?.unidade ?? 'CX'}
                        {c ? ` · ${formatValorNfe(c.valorTotalSaida)}` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onRemoverPalete(p.addressId)}
                    >
                      Remover
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="saida-totais-resumo" aria-live="polite">
              <div>
                <span className="muted">Caixas</span>
                <strong className="saida-valor--saindo">{formatQuantidadeNfe(totais.caixas)}</strong>
              </div>
              <div>
                <span className="muted">P. bruto</span>
                <strong>{formatPesoBruto(totais.pesoBruto)} kg</strong>
              </div>
              <div>
                <span className="muted">P. líquido</span>
                <strong>{formatPesoBruto(totais.pesoLiquido)} kg</strong>
              </div>
              <div>
                <span className="muted">V. total</span>
                <strong>{formatValorNfe(totais.valor)}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!selecaoConcluida) {
    return (
      <>
        <div className="consulta-enderecar-box saida-enderecar-box">
          <p className="consulta-enderecar-titulo">Selecione os paletes no painel</p>
          <p className="muted consulta-enderecar-texto">
            Clique nas células <strong>ocupadas deste item</strong> no mapa ao lado. Selecione{' '}
            <strong>{qtdPaletesAlvo ?? '—'}</strong> palete(s).
          </p>
          <p className="consulta-enderecar-contagem">
            Selecionados:{' '}
            <strong>
              {paletesSelecionados.length}
              {qtdPaletesAlvo != null ? ` / ${qtdPaletesAlvo}` : ''}
            </strong>
          </p>
          {paletesSelecionados.length > 0 && (
            <ul className="saida-paletes-lista saida-paletes-lista--selecao">
              {paletesSelecionados.map((a) => (
                <li key={a} className="saida-palete-item saida-palete-item--selecao">
                  <span>{formatAddressLabel(a)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selecaoErro && <p className="error">{selecaoErro}</p>}

        <button
          type="button"
          className="btn primary full"
          disabled={!selecaoCompleta}
          onClick={onConfirmarSelecaoPaletes}
        >
          Confirmar seleção de paletes
        </button>
      </>
    )
  }

  return (
    <>
      <div className="consulta-enderecar-box saida-enderecar-box">
        <p className="consulta-enderecar-titulo">Informe as caixas de cada palete</p>
        <p className="muted consulta-enderecar-texto">
          Confirme a quantidade de caixas para cada palete selecionado. Clique em outro palete no
          mapa para alternar.
        </p>
        {paleteAtivo ? (
          <p className="consulta-enderecar-contagem">
            Palete: <strong>{formatAddressLabel(paleteAtivo)}</strong>
            {itemAtivo && (
              <span className="muted">
                {' '}
                · {itemAtivo.codigo} — até {formatQuantidadeNfe(maxCaixas)} {itemAtivo.unidade}
                {itemAtivo.allocatedAddresses.length > 1 && (
                  <> ({formatQuantidadeNfe(caixasPorPalete(itemAtivo))} por palete)</>
                )}
              </span>
            )}
          </p>
        ) : (
          <p className="muted consulta-enderecar-contagem">
            Todos os paletes desta seleção foram confirmados
          </p>
        )}
      </div>

      {paleteAtivo && itemAtivo && (
        <div className="saida-paletes-form">
          <label className="consulta-campo">
            <span>Caixas nesta saída</span>
            <input
              type="number"
              min={0}
              max={maxCaixas}
              step="any"
              className={`input-nf${caixas != null && caixas > maxCaixas ? ' input-nf--error' : ''}`}
              value={caixasInput}
              onChange={(e) => onCaixasChange(e.target.value)}
              placeholder="0"
            />
          </label>

          <div className="saida-palete-calculo-grid">
            <div>
              <span className="muted">P. bruto saindo</span>
              <strong>{calc ? `${formatPesoBruto(calc.pesoBrutoSaida)} kg` : '—'}</strong>
            </div>
            <div>
              <span className="muted">P. líquido saindo</span>
              <strong>{calc ? `${formatPesoBruto(calc.pesoLiquidoSaida)} kg` : '—'}</strong>
            </div>
            <div>
              <span className="muted">V. total saindo</span>
              <strong className="saida-valor--saindo">
                {calc ? formatValorNfe(calc.valorTotalSaida) : '—'}
              </strong>
            </div>
            <div>
              <span className="muted">Sobra do item</span>
              <strong className="saida-valor--sobra">
                {calc
                  ? `${formatQuantidadeNfe(calc.quantidadeSobra)} ${calc.unidade}`
                  : `${formatQuantidadeNfe(itemAtivo.quantidade)} ${itemAtivo.unidade}`}
              </strong>
            </div>
          </div>

          {selecaoErro && <p className="error">{selecaoErro}</p>}

          <button
            type="button"
            className="btn primary full"
            disabled={!calc}
            onClick={onConfirmarPalete}
          >
            Confirmar palete
          </button>
        </div>
      )}

      {paletesConfirmados.length > 0 && (
        <div className="saida-paletes-confirmados">
          <p className="nf-section-title nf-section-title--sm">Paletes na saída</p>
          <ul className="saida-paletes-lista">
            {paletesConfirmados.map((p) => {
              const item = nf.items.find((it) => it.index === p.itemIndex)
              const c =
                item && calcularSaidaPalete(nf, item, p.addressId, p.quantidadeCaixas, [])
              return (
                <li key={p.addressId} className="saida-palete-item">
                  <div>
                    <strong>{formatAddressLabel(p.addressId)}</strong>
                    <span className="muted">
                      {' '}
                      · {formatQuantidadeNfe(p.quantidadeCaixas)} {item?.unidade ?? 'CX'}
                      {c ? ` · ${formatValorNfe(c.valorTotalSaida)}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => onRemoverPalete(p.addressId)}
                  >
                    Remover
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="saida-totais-resumo" aria-live="polite">
            <div>
              <span className="muted">Caixas</span>
              <strong className="saida-valor--saindo">{formatQuantidadeNfe(totais.caixas)}</strong>
            </div>
            <div>
              <span className="muted">P. bruto</span>
              <strong>{formatPesoBruto(totais.pesoBruto)} kg</strong>
            </div>
            <div>
              <span className="muted">P. líquido</span>
              <strong>{formatPesoBruto(totais.pesoLiquido)} kg</strong>
            </div>
            <div>
              <span className="muted">V. total</span>
              <strong>{formatValorNfe(totais.valor)}</strong>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
