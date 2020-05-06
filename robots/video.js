const state = require('./state.js')
const path = require('path')
const rootPath = path.resolve(__dirname, '..')
const fromRoot = relPath => path.resolve(rootPath, relPath)
const gm = require('gm').subClass({ imageMagick: true })
const videoshow = require('videoshow')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const ffprobePath = require('@ffprobe-installer/ffprobe').path
let ffmpeg = require('fluent-ffmpeg')
ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

const spawn = require('child_process').spawn

const jimp = require('jimp')

async function robot() {
    console.log('> [video-robot] Starting...')

    const content = state.load()
    await convertAllImages(content)
    await createAllSentencesImages(content)
    await createYoutubeThumbnail(content)
    await createAfterEffectsScript(content)
    await renderVideoWithAfterEffects(content)

    state.save(content)

    async function convertAllImages(content) {
        for (let sentenceIndex = 0; sentenceIndex < content.sentences.length; sentenceIndex++) {
            convertImage(sentenceIndex)
        }
    }

    async function convertImage(sentenceIndex) {
        return new Promise((resolve, reject) => {
            const inputFile = `./content/${sentenceIndex}-original.png`
            const outputFile = `./content/${sentenceIndex}-converted.png`
            const width = 1920
            const height = 1080

            jimp.read(inputFile)
                .then(newImg => {
                    console.log(`> [video-robot] Image converted: ${outputFile}`)
                    newImg
                        .resize(width, height) //resize
                        .quality(60) //set JPEG quality
                        .write(outputFile)
                }).catch(err => {
                    console.error(`> [video-robot] Erro: ${err}`)
                    throw new Error(err)
                })
        })
    }

    async function createAllSentencesImages(content) {
        for (let sentenceIndex = 0; sentenceIndex < content.sentences.length; sentenceIndex++) {
            await createSentenceImage(sentenceIndex, content.sentences[sentenceIndex].text)
        }
    }

    async function createSentenceImage(sentenceIndex, sentenceText) {
        const outputFile = `./content/${sentenceIndex}-sentence.png`

        const templateSettings = {
            0: {
                size: '1920x400',
                gravity: 'center'
            },
            1: {
                size: '1920x1080',
                gravity: 'center'
            },
            2: {
                size: '800x1080',
                gravity: 'west'
            },
            3: {
                size: '1920x400',
                gravity: 'center'
            },
            4: {
                size: '1920x1080',
                gravity: 'center'
            },
            5: {
                size: '800x1080',
                gravity: 'west'
            },
            6: {
                size: '1920x400',
                gravity: 'center'
            }
        }

        //0x0 - gera imagem com fundo transparente
        new jimp(1920, 1080, 0x0, (err, newImg) => {
            // this image is 256 x 256, every pixel is set to #FF00FF
            jimp.loadFont(jimp.FONT_SANS_128_WHITE).then(font => {
                console.log(`> [video-robot] Sentence created: ${outputFile}`)
                newImg
                    .print(font, 10, 10, {
                            text: sentenceText,
                            alignmentX: jimp.HORIZONTAL_ALIGN_CENTER,
                            alignmentY: jimp.VERTICAL_ALIGN_MIDDLE
                        },
                        1920,
                        1080
                    )
                    .write(outputFile);
            });
        });
    }

    async function createYoutubeThumbnail(content) {
        jimp.read('./content/0-original.png')
            .then(thumbnail => {
                console.log('> [video-robot] Creating Youtube thumbnail')
                return thumbnail
                    .write('./content/youtube-thumbnail.jpg')
            })
            .catch(err => {
                console.error(`> [video-robot] Erro: ${err}`)
            })
    }

    async function createAfterEffectsScript(content) {
        await state.saveScript(content)
    }

    async function renderVideoWithAfterEffects(content) {
        return new Promise((resolve, reject) => {
            const aerenderFilePath = "C:\\Program Files\\Adobe\\Adobe After Effects 2020\\Support Files\\aerender.exe"
            const templateFilePath = `${rootPath}/templates/1/template.aep`
            const destinationFilePath = `${rootPath}/content/output.mov`

            console.log('> [video-robot] Starting After Effects')

            const aerender = spawn(aerenderFilePath, [
                '-comp', 'main',
                '-project', templateFilePath,
                '-output', destinationFilePath
            ])

            aerender.stdout.on('data', data => {
                process.stdout.write(data)
            })

            aerender.on('close', () => {
                console.log('> [video-robot] After Effects closed')
                resolve()
            })
        })
    }
}

module.exports = robot