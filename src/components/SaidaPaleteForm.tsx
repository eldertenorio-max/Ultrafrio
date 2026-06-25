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
  paleteAtivo: AddressId | null
  caixasInput: string
  paletesConfirmados: SaidaPaleteDraft[]
  onCaixasChange: (value: string) => void
  onIniciarSelecao: () => void
  onConfirmarPalete: () => void
  onRemoverPalete: (addressId: AddressId) => void
  selecaoErro: string | null
}

export function SaidaPaleteForm({
  nf,
  modoPalete,
  paleteAtivo,
  caixasInput,
  paletesConfirmados,
  onCaixasChange,
  onIniciarSelecao,
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

  if (!modoPalete) {
    return (
      <div className="saida-paletes-form">
        {selecaoErro && <p className="error">{selecaoErro}</p>}
        <button type="button" className="btn primary full" onClick={onIniciarSelecao}>
          Selecionar palete no painel
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="consulta-enderecar-box saida-enderecar-box">
        <p className="consulta-enderecar-titulo">Selecione o palete no painel</p>
        <p className="muted consulta-enderecar-texto">
          Clique em uma célula <strong>ocupada desta NF</strong> no mapa ao lado para escolher o
          palete. Depois informe quantas caixas vai retirar.
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
          <p className="muted consulta-enderecar-contagem">Nenhum palete selecionado</p>
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
