import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { quantize } from '@gltf-transform/functions'
const [,, src, dst] = process.argv
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(src)
console.log('textures', doc.getRoot().listTextures().length, 'anims', doc.getRoot().listAnimations().length, 'roots', doc.getRoot().listScenes()[0].listChildren().length)
await doc.transform(quantize())
await io.write(dst, doc)
