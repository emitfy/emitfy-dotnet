/**
 * Decide se Emitfy (NuGet) deve publicar.
 * exit 0 = publish, 10 = skip, 1 = erro (mudou sem bump)
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packageId = 'Emitfy'
const userAgent = 'EmitfySDKPublish (mailto=dev@emitfy.com)'

function walkFiles(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      walkFiles(path, files)
    } else {
      files.push(path)
    }
  }
  return files
}

function readLocalVersion() {
  const text = readFileSync(join(root, 'Emitfy/Emitfy.csproj'), 'utf8')
  const match = text.match(/<Version>([^<]+)<\/Version>/)
  if (!match) {
    throw new Error('Version missing in Emitfy.csproj')
  }
  return match[1]
}

function contentHash(base) {
  const hash = createHash('sha256')
  const csprojCandidates = [
    join(base, 'Emitfy/Emitfy.csproj'),
    join(base, 'Emitfy.csproj'),
    ...walkFiles(base).filter((f) => f.endsWith('.csproj'))
  ]
  const csproj = csprojCandidates.find((p) => existsSync(p))
  if (csproj) {
    const text = readFileSync(csproj, 'utf8')
      .replaceAll('\r\n', '\n')
      .replace(/<Version>[^<]+<\/Version>/, '<Version>0.0.0</Version>')
    hash.update('Emitfy.csproj\0')
    hash.update(text)
    hash.update('\0')
  }

  const csFiles = walkFiles(base)
    .filter((f) => f.endsWith('.cs'))
    .sort((a, b) => relative(base, a).localeCompare(relative(base, b)))

  for (const file of csFiles) {
    const rel = relative(base, file).replaceAll('\\', '/').replace(/^Emitfy\//, '')
    hash.update(rel)
    hash.update('\0')
    hash.update(readFileSync(file, 'utf8').replaceAll('\r\n', '\n'))
    hash.update('\0')
  }
  return hash.digest('hex')
}

async function fetchNugetVersions() {
  const id = packageId.toLowerCase()
  const response = await fetch(`https://api.nuget.org/v3-flatcontainer/${id}/index.json`, {
    headers: { 'User-Agent': userAgent }
  })
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`NuGet HTTP ${response.status}`)
  }
  const data = await response.json()
  const versions = data.versions || []
  if (versions.length === 0) {
    return null
  }
  return versions[versions.length - 1]
}

const version = readLocalVersion()
const localHash = contentHash(join(root, 'Emitfy'))
const remoteVersion = await fetchNugetVersions()

if (!remoteVersion) {
  console.log(`no remote package — publish ${packageId} ${version}`)
  process.exit(0)
}

const id = packageId.toLowerCase()
const nupkgUrl = `https://api.nuget.org/v3-flatcontainer/${id}/${remoteVersion}/${id}.${remoteVersion}.nupkg`
const work = mkdtempSync(join(tmpdir(), 'emitfy-nuget-cmp-'))

try {
  const response = await fetch(nupkgUrl, {
    headers: { 'User-Agent': userAgent },
    redirect: 'follow'
  })
  if (!response.ok) {
    throw new Error(`nupkg HTTP ${response.status}`)
  }
  const archive = join(work, 'pkg.nupkg')
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()))
  execSync(`tar -xf "${archive}" -C "${work}"`, { stdio: 'pipe' })
  const remoteHash = contentHash(work)

  if (localHash === remoteHash) {
    console.log(
      `SDK unchanged vs ${packageId} ${remoteVersion} — skip (${localHash.slice(0, 12)})`
    )
    process.exit(10)
  }

  const index = await fetch(`https://api.nuget.org/v3-flatcontainer/${id}/index.json`, {
    headers: { 'User-Agent': userAgent }
  })
  const all = index.ok ? (await index.json()).versions || [] : []
  if (all.includes(version)) {
    console.error(
      `SDK changed, but ${packageId} ${version} already on NuGet. Bump Version in Emitfy.csproj.`
    )
    process.exit(1)
  }

  console.log(
    `SDK changed (${localHash.slice(0, 8)} ≠ ${remoteHash.slice(0, 8)}) — publish ${version}`
  )
  process.exit(0)
} finally {
  rmSync(work, { recursive: true, force: true })
}
