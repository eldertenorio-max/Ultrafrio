import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const targets = [
  [192, 'public/icon-192.png'],
  [512, 'public/icon-512.png'],
  [180, 'public/apple-touch-icon.png'],
]

const allExist = targets.every(([, path]) => existsSync(path))

async function main() {
  if (allExist && process.env.FORCE_ICON_GENERATE !== '1') {
    console.log('icon: usando PNGs versionados (FORCE_ICON_GENERATE=1 para regenerar)')
    return
  }

  const { Resvg } = await import('@resvg/resvg-js')
  const svg = readFileSync('public/favicon.svg')

  for (const [size, outPath] of targets) {
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: size },
    })
    const png = resvg.render().asPng()
    writeFileSync(outPath, png)
    console.log(`icon: gerado ${outPath}`)
  }
}

main().catch((e) => {
  if (allExist) {
    console.warn(`icon: falha ao regenerar (${e.message}) — usando PNGs existentes`)
    return
  }
  console.error(`icon: ${e.message ?? e}`)
  process.exit(1)
})
