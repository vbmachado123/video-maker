const imageDownloader = require('image-downloader')
const google = require('googleapis').google
const gm = require('gm').subClass({imageMagick: true})
const customSearch = google.customsearch('v1')
const state = require('./state.js')
const path = require('path')
const rootPath = path.resolve(__dirname, '..')
const fromRoot = relPath => path.resolve(rootPath, relPath)

const videoshow = require('videoshow')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const ffprobePath = require('@ffprobe-installer/ffprobe').path
let ffmpeg = require('fluent-ffmpeg')
ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

const jimp = require('jimp')

const googleSearchCredentials = require('../credentials/google-search.json')

async function robot() {
	console.log('> [image-robot] Starting...')

	const content = state.load()

	await fetchImagesOfAllSentences(content)
	await downloadAllImages(content)
	await convertAllImages(content)
	await createAllSentencesImages(content)
	await createYoutubeThumbnail(content)
	state.save(content)

	async function fetchImagesOfAllSentences(content){
		for (const sentence of content.sentences){
			const query = `${content.searchTerm} ${sentence.keywords[0]}`
			sentence.images = await fetchGoogleAndReturnImagesLink(query)
	
			sentence.googleSearchQuery = query
		}

	}

	async function fetchGoogleAndReturnImagesLink(query){
		const response = await customSearch.cse.list({
			auth: googleSearchCredentials.apikey,
			cx: googleSearchCredentials.searchEngineId,
			q: query,
			searchType: 'image',
			num: 2
		})

		const imagesUrl = response.data.items.map((item) => {
			return item.link
		})

		return imagesUrl
	}

	async function downloadAllImages(content) {
	content.downloadedImages = []

		for (let sentenceIndex = 0; sentenceIndex < content.sentences.length; sentenceIndex++) {
			const images = content.sentences[sentenceIndex].images
			for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
				const imageUrl = images[imageIndex]

				try {
					if (content.downloadedImages.includes(imageUrl)) {
						throw new Error('Image already downloaded')
					}
					await downloadAndSave(imageUrl, `${sentenceIndex}-original.png`)
					content.downloadedImages.push(imageUrl)
					console.log(`> [image-robot] [${sentenceIndex}][${imageIndex}] Image successfully downloaded: ${imageUrl}`)
					break
					} catch(error) {
					console.log(`> [image-robot] [${sentenceIndex}][${imageIndex}] Error (${imageUrl}): ${error}`)
					}
				}

		}
	}

	async function downloadAndSave(url, fileName) {
	return imageDownloader.image({
		url: url,
		dest: `./content/${fileName}`
		})
	}

	async function convertAllImages(content) {
			for(let sentenceIndex = 0; sentenceIndex < content.sentences.length; sentenceIndex++) {
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
				console.log( `> [image-robot] Image converted: ${outputFile}`)
				 newImg
				.resize(width, height) //resize
				.quality(60) //set JPEG quality
				.write(outputFile)
			}) .catch(err =>{
				console.error(`> [image-robot] Erro: ${err}`)
				throw new Error(err)
			})
			})
	}
	
	async function createAllSentencesImages(content) {
		for(let sentenceIndex =0; sentenceIndex < content.sentences.length; sentenceIndex++){
            await createSentenceImage(sentenceIndex, content.sentences[sentenceIndex].text)
        }
	}

	async function createSentenceImage(sentenceIndex, sentenceText){
		const outputFile = `./content/${sentenceIndex}-sentence.png`
		
		const templateSettings ={
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
              console.log(`> [image-robot] Sentence created: ${outputFile}`)  
              newImg
              .print(font, 10, 10, 
                {
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
	
	async function createYoutubeThumbnail(content){
		jimp.read('./content/0-original.png')
		.then(thumbnail => {
			console.log('> [image-robot] Creating Youtube thumbnail')
			return thumbnail
			.write('./content/youtube-thumbnail.jpg')
		})
		.catch(err => {
			console.error(`> [image-robot] Erro: ${err}`)
		})
	}
}	

module.exports = robot