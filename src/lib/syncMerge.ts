import type { PersistedData } from '../types'

function entityById<T extends { id: string }>(list: T[], id: string): T | undefined {
  return list.find((x) => x.id === id)
}

function entityJson<T>(entity: T | undefined): string {
  return entity === undefined ? '__missing__' : JSON.stringify(entity)
}

export function pickPersisted(state: {
  notas: PersistedData['notas']
  movimentos: PersistedData['movimentos']
  notasCanceladas: PersistedData['notasCanceladas']
  emitentes: PersistedData['emitentes']
}): PersistedData {
  return {
    notas: state.notas,
    movimentos: state.movimentos,
    notasCanceladas: state.notasCanceladas,
    emitentes: state.emitentes,
  }
}

export function persistedEquals(a: PersistedData, b: PersistedData): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Mescla base → local vs remoto: alterações locais prevalecem; o restante vem da nuvem. */
export function mergeEntityList<T extends { id: string }>(
  base: T[],
  local: T[],
  remote: T[],
): T[] {
  const allIds = new Set([
    ...base.map((x) => x.id),
    ...local.map((x) => x.id),
    ...remote.map((x) => x.id),
  ])
  const result: T[] = []

  for (const id of allIds) {
    const b = entityById(base, id)
    const l = entityById(local, id)
    const r = entityById(remote, id)

    if (entityJson(b) !== entityJson(l)) {
      if (l !== undefined) result.push(l)
      continue
    }

    if (entityJson(b) !== entityJson(r)) {
      if (r !== undefined) result.push(r)
      continue
    }

    if (l !== undefined) result.push(l)
  }

  return result
}

function mergeEmitentes(base: string[], local: string[], remote: string[]): string[] {
  const baseSet = new Set(base)
  const localChanged =
    base.length !== local.length || local.some((nome) => !baseSet.has(nome))

  if (localChanged) {
    return [...new Set([...local, ...remote])]
  }

  return [...new Set([...remote, ...base])]
}

export function mergePersistedData(
  base: PersistedData,
  local: PersistedData,
  remote: PersistedData,
): PersistedData {
  return {
    notas: mergeEntityList(base.notas, local.notas, remote.notas),
    movimentos: mergeEntityList(base.movimentos, local.movimentos, remote.movimentos),
    notasCanceladas: mergeEntityList(base.notasCanceladas, local.notasCanceladas, remote.notasCanceladas),
    emitentes: mergeEmitentes(base.emitentes, local.emitentes, remote.emitentes),
  }
}
