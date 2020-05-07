const algorithmia = require('algorithmia')
const algorithmiaApiKey = require('../credentials/algorithmia.json').apiKey
const sentencesBoundaryDetection = require('sbd')
const watsonApiKey = require('../credentials/watson-nlu.json').apikey
const watsonUrl = require('../credentials/watson-nlu.json').url

//const auth =  require ('ibm-watson/auth');
const { IamAuthenticator } = require('ibm-watson/auth');
//const NaturalLanguageUnderstandingV1 = require ('ibm-watson/discovery/v1')
const NaturalLanguageUnderstandingV1 = require('ibm-watson/natural-language-understanding/v1')

const nlu = new NaturalLanguageUnderstandingV1({
    authenticator: new IamAuthenticator({ apikey: watsonApiKey }),
    version: '2018-04-05',
    url: watsonUrl
})

const state = require('./state.js')

async function robot() {

    console.log('> [robô-texto] Iniciando..')
    const content = state.load()

    await fetchContentFromWikipedia(content)
    sanitizeContent(content)
    breakContentIntoSentences(content)
    limitMaximumSentences(content)
    await fetchKeywordsOfAllSentences(content)

    state.save(content)

    async function fetchContentFromWikipedia(content) {
        console.log('> [robô-texto] Buscando conteúdo da Wikipedia')
        const algorithmiaAutenticated = algorithmia(algorithmiaApiKey)
        const wikipediaAlgorithm = algorithmiaAutenticated.algo("web/WikipediaParser/0.1.2?timeout=300")
        const wikipediaResponse = await wikipediaAlgorithm.pipe({
            "lang": 'pt',
            "articleName": content.searchTerm
        })
        const wikipediaContent = wikipediaResponse.get()

        content.sourceContentOriginal = wikipediaContent.content
        console.log('> [robô-texto] Busca concluída!')
    }

    function sanitizeContent(content) {
        const withoutBlankLinesAndMarkdown = removeBlankLinesAndMarkdown(content.sourceContentOriginal)
        const withoutDatesInParentheses = removeDatesInParentheses(withoutBlankLinesAndMarkdown)

        content.sourceContentSanitized = withoutDatesInParentheses

        function removeBlankLinesAndMarkdown(text) {
            const allLines = text.split('\n')

            const withoutBlankLinesAndMarkdown = allLines.filter((line) => {
                if (line.trim().length === 0 || line.trim().startsWith('=')) {
                    return false
                }

                return true
            })

            return withoutBlankLinesAndMarkdown.join(' ')
        }
    }

    function removeDatesInParentheses(text) {
        return text.replace(/\((?:\([^()]*\)|[^()])*\)/gm, '').replace(/  /g, ' ')
    }

    function breakContentIntoSentences(content) {
        content.sentences = []
        const sentences = sentencesBoundaryDetection.sentences(content.sourceContentSanitized)
        sentences.forEach((sentence) => {

            content.sentences.push({
                text: sentence,
                keywords: [],
                images: []
            })
        })
    }

    function limitMaximumSentences(content) {
        content.sentences = content.sentences.slice(0, content.maximumSentences)


    }

    async function fetchKeywordsOfAllSentences(content) {
        console.log('> [robô-texto] Começando a buscar palavras-chave com o Watson')
        for (const sentence of content.sentences) {
            console.log(`> [robô-texto] Sentença: "${sentence.text}"`)

            sentence.keywords = await fetchWatsonAndReturnKeywords(sentence.text)

            console.log(`> [robô-texto] Palavras-chave: ${sentence.keywords.join(', ')}\n`)
        }

    }

    async function fetchWatsonAndReturnKeywords(sentence) {
        return new Promise((resolve, reject) => {
            nlu.analyze({
                text: sentence,
                features: {
                    keywords: {}
                }
            }, (error, response) => {
                if (error) {
                    reject(error)
                    return
                }

                const keywords = response.result.keywords.map((keyword) => {
                    return keyword.text
                })

                resolve(keywords)
            })
        })
    }
}

module.exports = robot