const tcpProxy = require('node-tcp-proxy');
const argparse = require('argparse');
const logger = require('simple-node-logger').createSimpleLogger();

const OnvifServer = require('./src/onvif-server');
const { readAndCheckConfig } = require('./src/config-tools');


const parser = new argparse.ArgumentParser({
    description: 'Virtual RTSP to ONVIF proxy'
});

parser.add_argument('config', { help: 'config filename to use', nargs: '?' });

let args = parser.parse_args();

if (args) {
    if (process.env.DEBUG) {
        logger.setLevel('trace');
    }

    if (!args.config) {
        logger.info('Please specifiy a config filename!');
        return -1;
    }

    let config = readAndCheckConfig(logger, args.config)

    let proxies = [];
    for (let onvifConfig of config.onvif) {

        let server = new OnvifServer(logger, onvifConfig);

        if (server.getHostname()) {

            logger.info('');
            server.startHttpServer();
            server.startDiscovery();
            if (process.env.DEBUG)
                server.enableDebugOutput()

            if (onvifConfig.ports.rtsp && onvifConfig.target.ports.rtsp) {
                proxies.push({
                    listenAddress: server.getHostname(),
                    listenPort: onvifConfig.ports.rtsp,
                    targetAddress: onvifConfig.target.hostname,
                    targetPort: onvifConfig.target.ports.rtsp
                });
            }
            if (onvifConfig.ports.snapshot && onvifConfig.target.ports.snapshot) {
                proxies.push({
                    listenAddress: server.getHostname(),
                    listenPort: onvifConfig.ports.snapshot,
                    targetAddress: onvifConfig.target.hostname,
                    targetPort: onvifConfig.target.ports.snapshot
                });
            }
        } else {
            logger.error(`Failed to find IP address for MAC address ${onvifConfig.mac}`)
            return -1;
        }
    }

    for (let proxy of proxies) {
        logger.info(`PROXY: ${proxy.listenAddress}:${proxy.listenPort} --> ${proxy.targetAddress}:${proxy.targetPort}`);
        tcpProxy.createProxy(proxy.listenPort, proxy.targetAddress, proxy.targetPort, { hostname: proxy.listenAddress });
    }

    return 0;
}
