const express = require('express')
const google = require('googleapis').google
const youtube = google.youtube({ version: 'v3' })
const OAuth2 = google.auth.OAuth2
const state = require('./state.js')
const fs = require('fs')
const open = require('open')

async function robot() {
    console.log('> [robô-youtube] Iniciando...')

    const content = state.load()

    await authenticateWithOAuth()
    const videoInformation = await uploadVideo(content)
    await uploadThumbnail(videoInformation)

    async function authenticateWithOAuth() {
        const webServer = await startWebServer()
        const OAtuhClient = await createOAuthClient()
        requestUserConsent(OAtuhClient)
        const authorizationToken = await waitForGoogleCallback(webServer)
        await requestGoogleForAccessTokens(OAtuhClient, authorizationToken)
        await setGlogalGoogleAuthentication(OAtuhClient)
        await stopWebServer(webServer)

        async function startWebServer() {
            return new Promise((resolve, reject) => {
                const port = 5000
                const app = express()

                const server = app.listen(port, () => {
                    console.log(`> [robô-youtube] Ouvindo em http://localhost:${port}`)

                    resolve({
                        app,
                        server
                    })
                })
            })
        }

        async function createOAuthClient() {
            const credentials = require('../credentials/google-youtube.json')

            const OAtuhClient = new OAuth2(
                credentials.web.client_id,
                credentials.web.client_secret,
                credentials.web.redirect_uris[0]
            )
            return OAtuhClient
        }

        function requestUserConsent(OAtuhClient) {
            const consentUrl = OAtuhClient.generateAuthUrl({
                access_type: 'offline',
                scope: ['https://www.googleapis.com/auth/youtube']
            })

            open(consentUrl)
                //console.log(`> [youtube-robot] please give yout consent: ${consentUrl}`)
        }

        async function waitForGoogleCallback(webServer) {
            return new Promise((resolve, reject) => {
                console.log('> [robô-youtube] Aguardando autorização do usuário...')

                webServer.app.get('/oauth2callback', (req, res) => {
                    const authCode = req.query.code
                    console.log(`> [robô-youtube] Autorização consentida: ${authCode}`)

                    res.send('<h1>Obrigado!</h1><p>Agora, feche essa janela.</p>')
                    resolve(authCode)
                })
            })
        }

        async function requestGoogleForAccessTokens(OAtuhClient, authenticateWithOAuth) {
            return new Promise((resolve, reject) => {
                OAtuhClient.getToken(authorizationToken, (error, tokens) => {
                    if (error) {
                        return reject(error)
                    }
                    console.log('> [robô-youtube] Tokens de acesso recebidos!')

                    OAtuhClient.setCredentials(tokens)
                    resolve()
                })
            })
        }

        async function setGlogalGoogleAuthentication(OAtuhClient) {
            google.options({
                auth: OAtuhClient
            })
        }
        async function stopWebServer(webServer) {
            return new Promise((resolve, reject) => {
                webServer.server.close(() => {
                    resolve()
                })
            })
        }
    }

    async function uploadVideo(content) {
        const videoFilePath = './content/output.mov'
        const videoFileSize = fs.statSync(videoFilePath).size
        const videoTitle = `${content.prefix} ${content.searchTerm}`
        const videoTags = [content.searchTerm, ...content.sentences[0].keywords]
        const videoDescription = content.sentences.map((sentence) => {
            return sentence.text
        }).join('\n\n')

        const requestParameters = {
            part: 'snippet, status',
            requestBody: {
                snippet: {
                    title: videoTitle,
                    description: videoDescription,
                    tags: videoTags
                },
                status: {
                    privacyStatus: 'unlisted'
                }
            },
            media: {
                body: fs.createReadStream(videoFilePath)
            }
        }

        console.log('> [robô-youtube] Iniciando o upload do vídeo para o Youtube')

        const youtubeResponse = await youtube.videos.insert(requestParameters, {
            onUploadProgress: onUploadProgress
        })

        open(`https://youtu.be/${youtubeResponse.data.id}`)
        console.log(`> [robô-youtube] Vídeo disponível em: https://youtu.be/${youtubeResponse.data.id}`)
        return youtubeResponse.data

        function onUploadProgress(event) {
            const progress = Math.round((event.bytesRead / videoFileSize) * 100)
            console.log(`> [robô-youtube] ${progress}% completado`)
        }
    }

    async function uploadThumbnail(videoInformation) {
        const videoId = videoInformation.id
        const videoThumbnailFilePath = './content/youtube-thumbnail.jpg'

        console.log('> [robô-youtube] Alterando a thumbnail')

        const requestParameters = {
            videoId: videoId,
            media: {
                mimeType: 'image/jpeg',
                body: fs.createReadStream(videoThumbnailFilePath)
            }
        }

        const youtubeResponse = await youtube.thumbnails.set(requestParameters)
        console.log('> [robô-youtube] Thumbnail atualizada!')

    }
}

module.exports = robot