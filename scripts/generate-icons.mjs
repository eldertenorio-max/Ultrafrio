import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const svg = readFileSync('public/favicon.svg')

function renderPng(size, outPath) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  })
  const png = resvg.render().asPng()
  writeFileSync(outPath, png)
  console.log(`icon: gerado ${outPath}`)
}

renderPng(192, 'public/icon-192.png')
renderPng(512, 'public/icon-512.png')
renderPng(180, 'public/apple-touch-icon.png')
