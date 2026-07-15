/**
 * Decide se Emitfy (NuGet) deve publicar
.
 * exit 0 = publish, 10 = skip, 1 = erro (m
udou sem bump)
 */
import { createHash } from
 'node:crypto'
import {
  existsSync,
  mkdte
mpSync,
  readFileSync,
  readdirSync,
  rmSy
nc,
  statSync,
  writeFileSync
} from 'node:
fs'
import { tmpdir } from 'node:os'
import {
 dirname, join, relative } from 'node:path'
i
mport { fileURLToPath } from 'node:url'
impor
t { execSync } from 'node:child_process'

con
st root = join(dirname(fileURLToPath(import.m
eta.url)), '..')
const packageId = 'Emitfy'
c
onst userAgent = 'EmitfySDKPublish (mailto=de
v@emitfy.com)'

function walkFiles(dir, files
 = []) {
  for (const name of readdirSync(dir
)) {
    const path = join(dir, name)
    if 
(statSync(path).isDirectory()) {
      walkFi
les(path, files)
    } else {
      files.pus
h(path)
    }
  }
  return files
}

function 
readLocalVersion() {
  const text = readFileS
ync(join(root, 'Emitfy/Emitfy.csproj'), 'utf8
')
  const match = text.match(/<Version>([^<]
+)<\/Version>/)
  if (!match) {
    throw new
 Error('Version missing in Emitfy.csproj')
  
}
  return match[1]
}

function contentHash(b
ase) {
  const hash = createHash('sha256')
  
const csprojCandidates = [
    join(base, 'Em
itfy/Emitfy.csproj'),
    join(base, 'Emitfy.
csproj'),
    ...walkFiles(base).filter((f) =
> f.endsWith('.csproj'))
  ]
  const csproj =
 csprojCandidates.find((p) => existsSync(p))

  if (csproj) {
    const text = readFileSync
(csproj, 'utf8')
      .replaceAll('\r\n', '\
n')
      .replace(/<Version>[^<]+<\/Version>
/, '<Version>0.0.0</Version>')
    hash.updat
e('Emitfy.csproj\0')
    hash.update(text)
  
  hash.update('\0')
  }

  const csFiles = wa
lkFiles(base)
    .filter((f) => f.endsWith('
.cs'))
    .sort((a, b) => relative(base, a).
localeCompare(relative(base, b)))

  for (con
st file of csFiles) {
    const rel = relativ
e(base, file).replaceAll('\\', '/').replace(/
^Emitfy\//, '')
    hash.update(rel)
    hash
.update('\0')
    hash.update(readFileSync(fi
le, 'utf8').replaceAll('\r\n', '\n'))
    has
h.update('\0')
  }
  return hash.digest('hex'
)
}

async function fetchNugetVersions() {
  
const id = packageId.toLowerCase()
  const re
sponse = await fetch(`https://api.nuget.org/v
3-flatcontainer/${id}/index.json`, {
    head
ers: { 'User-Agent': userAgent }
  })
  if (r
esponse.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`N
uGet HTTP ${response.status}`)
  }
  const da
ta = await response.json()
  const versions =
 data.versions || []
  if (versions.length ==
= 0) {
    return null
  }
  return versions[
versions.length - 1]
}

const version = readL
ocalVersion()
const localHash = contentHash(j
oin(root, 'Emitfy'))
const remoteVersion = aw
ait fetchNugetVersions()

if (!remoteVersion)
 {
  console.log(`no remote package — publi
sh ${packageId} ${version}`)
  process.exit(0
)
}

const id = packageId.toLowerCase()
const
 nupkgUrl = `https://api.nuget.org/v3-flatcon
tainer/${id}/${remoteVersion}/${id}.${remoteV
ersion}.nupkg`
const work = mkdtempSync(join(
tmpdir(), 'emitfy-nuget-cmp-'))

try {
  cons
t response = await fetch(nupkgUrl, {
    head
ers: { 'User-Agent': userAgent },
    redirec
t: 'follow'
  })
  if (!response.ok) {
    th
row new Error(`nupkg HTTP ${response.status}`
)
  }
  const archive = join(work, 'pkg.nupkg
')
  writeFileSync(archive, Buffer.from(await
 response.arrayBuffer()))
  execSync(`tar -xf
 "${archive}" -C "${work}"`, { stdio: 'pipe' 
})
  const remoteHash = contentHash(work)

  
if (localHash === remoteHash) {
    console.l
og(
      `SDK unchanged vs ${packageId} ${re
moteVersion} — skip (${localHash.slice(0, 1
2)})`
    )
    process.exit(10)
  }

  const
 index = await fetch(`https://api.nuget.org/v
3-flatcontainer/${id}/index.json`, {
    head
ers: { 'User-Agent': userAgent }
  })
  const
 all = index.ok ? (await index.json()).versio
ns || [] : []
  if (all.includes(version)) {

    console.error(
      `SDK changed, but ${
packageId} ${version} already on NuGet. Bump 
Version in Emitfy.csproj.`
    )
    process.
exit(1)
  }

  console.log(
    `SDK changed 
(${localHash.slice(0, 8)} ≠ ${remoteHash.sl
ice(0, 8)}) — publish ${version}`
  )
  pro
cess.exit(0)
} finally {
  rmSync(work, { rec
ursive: true, force: true })
}


