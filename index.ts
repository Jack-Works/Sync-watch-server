import cluster from 'cluster'
import fs from 'fs'
import { join } from 'path'
import http from 'http'
import https from 'https'
import serveStatic from 'serve-static'

function main() {
    if (cluster.isMaster) {
        return (
            cluster.fork() &&
            cluster.on('exit', function() {
                cluster.fork()
            })
        )
    }

    var config: Record<string, any> = {
        port:
            process.env.OPENSHIFT_NODEJS_PORT ||
            process.env.VCAP_APP_PORT ||
            process.env.PORT ||
            process.argv[2] ||
            8765,
    }
    var Gun = require('gun')
    const hasWeb = fs.existsSync(join(__dirname, './web/'))
    if (!hasWeb) {
        console.warn(`Please build sync-watch and move it to ./web, or this server will be a pure API server`)
    }

    const gunServer = Gun.serve(__dirname)
    const staticServer = serveStatic(join(__dirname, './web/'))
    const combinedServer: Parameters<typeof http.createServer>[0] = hasWeb
        ? (request, response) => {
              if (request.url!.startsWith('/gun')) gunServer(request, response)
              else staticServer(request, response, () => {})
          }
        : gunServer
    if (process.env.HTTPS_KEY) {
        config.key = fs.readFileSync(process.env.HTTPS_KEY)
        config.cert = fs.readFileSync(process.env.HTTPS_CERT!)
        config.server = https.createServer(config, combinedServer)
    } else {
        config.server = http.createServer(combinedServer)
    }
    Gun({ web: config.server.listen(config.port) })
    console.log('Relay peer started on port ' + config.port + ' with /gun')
}
main()
