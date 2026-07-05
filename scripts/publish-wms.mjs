#!/usr/bin/env node
/**
 * Merge homolog → main e alinha as branches (publicar no WMS).
 * Deploy manual no Render continua necessário (Auto Deploy off na produção).
 *
 * Uso: npm run publish:wms
 */
import { execSync } from 'node:child_process'

function run(cmd) {
  console.log(`> ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

function currentBranch() {
  return execSync('git branch --show-current', { encoding: 'utf8' }).trim()
}

const startBranch = currentBranch()

try {
  run('git fetch origin')
  run('git checkout main')
  run('git pull origin main')
  run('git merge homolog -m "Publica homolog no WMS (merge homolog → main)."')
  run('git push origin main')
  run('git checkout homolog')
  run('git merge main')
  run('git push origin homolog')
  console.log('\nBranches main e homolog alinhadas.')
  console.log('Próximo passo: Render → Ultrafrio (WMS) → Manual Deploy → Clear build cache & deploy')
  console.log('Depois: npm run check:deploy')
} catch (err) {
  console.error('\nFalha ao publicar. Resolva conflitos e tente de novo.')
  process.exit(1)
} finally {
  if (currentBranch() !== startBranch) {
    try {
      run(`git checkout ${startBranch}`)
    } catch {
      /* ignore */
    }
  }
}
