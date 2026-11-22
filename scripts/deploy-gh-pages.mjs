// Deploy manuale su GitHub Pages (alternativa al workflow): compila con il base path
// corretto e pubblica la cartella dist sul branch gh-pages del remote "origin".
// Uso: npm run deploy:gh   (poi Settings → Pages → Source: branch gh-pages, cartella /root)
import { execSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });
const out = (cmd) => execSync(cmd).toString().trim();

let remote;
try {
  remote = out('git remote get-url origin');
} catch {
  console.error('Nessun remote "origin": crea il repository su GitHub e collegalo con  git remote add origin <url>');
  process.exit(1);
}
const repo = remote.replace(/\.git$/, '').split(/[/:]/).pop();
const base = repo.endsWith('.github.io') ? '/' : `/${repo}/`;
console.log(`Build con base "${base}" per ${remote}`);

sh('npm run build', { env: { ...process.env, VITE_BASE: base } });
writeFileSync('dist/.nojekyll', '');

if (existsSync('dist/.git')) rmSync('dist/.git', { recursive: true, force: true });
sh('git init -q -b gh-pages', { cwd: 'dist' });
sh('git add -A', { cwd: 'dist' });
sh('git commit -q -m "Deploy AnatoQuiz"', { cwd: 'dist' });
sh(`git push -f "${remote}" gh-pages`, { cwd: 'dist' });
rmSync('dist/.git', { recursive: true, force: true });
console.log('Pubblicato sul branch gh-pages.');
