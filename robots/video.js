const gm = require('gm').subClass({ imageMagick: true })
const state = require('./state.js')
const spawn = require('child_process').spawn
const path = require('path')
const os = require('os');
const rootPath = path.resolve(__dirname, '..')

const fromRoot = relPath => path.resolve(rootPath, relPath)

async function robot() {
    console.log('> [robô-video] Iniciando...')

    const content = state.load()
    await convertAllImages(content)
    await createAllSentencesImages(content)
    await createYoutubeThumbnail(content)
    await createAfterEffectsScript(content)
    await renderVideoWithAfterEffects(content)

    state.save(content)

    async function convertAllImages(content) {
        for (let sentenceIndex = 0; sentenceIndex < content.sentences.length; sentenceIndex++) {
            await convertImage(sentenceIndex)
        }
    }

    async function convertImage(sentenceIndex) {
        return new Promise((resolve, reject) => {
            const inputFile = `./content/${sentenceIndex}-original.png`
            const outputFile = `./content/${sentenceIndex}-converted.png`
            const width = 1920
            const height = 1080

            gm()
                .in(inputFile)
                .out('(')
                .out('-clone')
                .out('0')
                .out('-background', 'white')
                .out('-blur', '0x9')
                .out('-resize', `${width}x${height}^`)
                .out(')')
                .out('(')
                .out('-clone')
                .out('0')
                .out('-background', 'white')
                .out('-resize', `${width}x${height}`)
                .out(')')
                .out('-delete', '0')
                .out('-gravity', 'center')
                .out('-compose', 'over')
                .out('-composite')
                .out('-extent', `${width}x${height}`)
                .write(outputFile, (error) => {
                    if (error) {
                        return reject(error)
                    }

                    console.log(`> [robô-video] Imagem convertida: ${outputFile}`)
                    resolve()
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
        gm()
            .out('-size', templateSettings[sentenceIndex].size)
            .out('-gravity', templateSettings[sentenceIndex].gravity)
            .out('-background', 'transparent')
            .out('-fill', 'white')
            .out('-kerning', '-1')
            .out(`caption:${sentenceText}`)
            .write(outputFile, (error) => {
                if (error) {
                    return reject(error)
                }
                console.log(`> [robô-video] Sentenca criada: ${outputFile}`)
            })
    }

    async function createYoutubeThumbnail(content) {
        return new Promise((resolve, reject) => {
            gm()
                .in(fromRoot('./content/0-converted.png'))
                .write(fromRoot('./content/youtube-thumbnail.jpg'), (error) => {
                    if (error) {
                        return reject(error)
                    }

                    console.log('> [robô-video] Thumbnail para o YouTube criada')
                    resolve()
                })
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

            console.log('> [robô-video] Iniciando After Effects')

            const aerender = spawn(aerenderFilePath, [
                '-comp', 'main',
                '-project', templateFilePath,
                '-output', destinationFilePath
            ])

            aerender.stdout.on('data', data => {
                process.stdout.write(data)
            })

            aerender.on('close', () => {
                console.log('> [robô-video] After Effects foi encerrado')
                resolve()
            })
        })
    }
}

module.exports = robot