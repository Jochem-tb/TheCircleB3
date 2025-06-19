import { Injectable, NgZone } from '@angular/core';
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { Device, types } from 'mediasoup-client';

@Injectable({ providedIn: 'root' })
export class MediasoupService {
    private socket!: any;
    private device!: Device;
    private recvTransport!: types.Transport;
    private consumers: types.Consumer[] = [];

    constructor(private ngZone: NgZone) {}

    /**
     * Initialize and start receiving a stream.
     * @param streamId ID of the stream to consume
     * @param videoElement HTMLVideoElement to render video
     */
    async initStream(streamId: string, videoElement: HTMLVideoElement) {
        // 1️⃣ Connect to Socket.IO
        console.log('🔗 Connecting to mediasoup server...');
        this.socket = io('http://localhost:8090', {
            transports: ['websocket'],
        });

        this.socket.on('connect', async () => {
            console.log('✅ Connected to mediasoup server');

            // 2️⃣ Load Device with RTP capabilities
            console.log('📦 Loading mediasoup Device...');
            this.device = new Device();
            console.log('[device]', this.device);
            const routerRtpCapabilities = await this.request(
                'getRouterRtpCapabilities',
                { streamId }
            );
            console.log(
                '📦 Router RTP capabilities received:' + routerRtpCapabilities
            );
            await this.device.load({ routerRtpCapabilities });
            console.log(
                '📦 Device loaded with routerRtpCapabilities:',
                this.device
            );
            if (!this.device.rtpCapabilities) {
                console.error('❌ Failed to load mediasoup Device');
                return;
            }
            console.log('📦 Device loaded successfully');

            // 3️⃣ Create recv transport
            console.log(
                '📡 Client rtpCapabilities:',
                this.device.rtpCapabilities
            );
            console.log('🚚 Creating recv transport...');
            const { id, iceParameters, iceCandidates, dtlsParameters } =
                await this.request('joinStream', {
                    streamId,
                    rtpCapabilities: this.device.rtpCapabilities,
                });

            console.log(
                `🚚 Recv transport parameters: id=${id}, iceParameters=${iceParameters}, dtlsParameters=${dtlsParameters}`
            );

            this.recvTransport = this.device.createRecvTransport({
                id,
                iceParameters,
                iceCandidates,
                dtlsParameters,
            });
            console.log(`🚚 Recv transport created: ${id}`);

            // 4️⃣ Connect DTLS
            console.log('🔒 Connecting recv transport...');
            this.recvTransport.on(
                'connect',
                ({ dtlsParameters }, callback, errback) => {
                    console.log(
                        `🔒 Connected transport ${id} with DTLS parameters: ${dtlsParameters}`
                    );
                    this.socket.emit(
                        'connectTransport',
                        { transportId: id, dtlsParameters },
                        (res: any) => {
                            console.log(
                                `🔒 [connectTransport] Transport connection response: ${res}`
                            );
                            res === 'connected' ? callback() : errback(res);
                        }
                    );
                }
            );

            this.recvTransport.on('connectionstatechange', (state) => {
                console.log(`🔗 Transport state: ${state}`);
            });

            // 5️⃣ Consume

            console.log('👀 Requesting consume...');
            const consumerInfos = await this.request('consume', {
                streamId,
                rtpCapabilities: this.device.rtpCapabilities,
            });
            console.log(
                `👀 Received ${consumerInfos.length} consumer infos:`,
                consumerInfos
            );
            if (!consumerInfos.length) {
                console.error('❌ No producers available');
                return;
            }

            // 6️⃣ Create local consumers
            console.log('🎥 Creating local consumers...');
            for (const info of consumerInfos) {
                const consumer = await this.recvTransport.consume({
                    id: info.id,
                    producerId: info.producerId,
                    kind: info.kind,
                    rtpParameters: info.rtpParameters,
                });
                console.log(
                    `🎥 Consumer created: ${consumer.id}, kind=${consumer.kind}`
                );
                this.consumers.push(consumer);
                console.log(
                    `Consumer ${consumer.id} created for producer ${info.producerId} added to consumers list: ${this.consumers.length} consumers`
                );

                // Log track events for debugging packet flow
                consumer.on('transportclose', () =>
                    console.warn(`Consumer ${consumer.id} transport closed`)
                );
                // consumer.on('producerclose', () =>
                //     console.warn(`Producer for consumer ${consumer.id} closed`)
                // );
                consumer.track.onmute = () =>
                    console.log(`Track ${consumer.id} muted`);
                consumer.track.onunmute = () =>
                    console.log(`Track ${consumer.id} unmuted`);

                console.log(
                    `🎬 Consumer created: ${consumer.id}, kind=${consumer.kind}`
                );
                this.ngZone.runOutsideAngular(() => {
                    console.log(
                        `🔄 Setting up video element for consumer ${consumer.id}`
                    );
                    if (consumer.kind === 'video') {
                        console.log(
                            `Consumer track = ${consumer.track.kind}, readyState=${consumer.track.readyState}`
                        );
                        const stream = new MediaStream([consumer.track]);
                        console.log('stream object,', stream);
                        videoElement.srcObject = stream;
                        videoElement.muted = true;
                        console.log(
                            `🎥 Video element: ${videoElement} set for consumer ${consumer.id}`
                        );
                        videoElement.play().catch(console.error);
                    }
                });

                // 7️⃣ Resume server-side
                console.log(`▶️ Resuming consumer ${info.id}`);
                await this.request('resume', { consumerId: info.id });

                // 8️⃣ Periodically log consumer stats to verify packet arrival
                setInterval(async () => {
                    try {
                        // Iterate stats entries and log key metrics
                        const stats = await consumer.getStats();
                        stats.forEach((stat: any) => {
                            if (
                                stat.type === 'inbound-rtp' &&
                                stat.kind === 'video'
                            ) {
                                console.log(
                                    `🔍 Consumer ${consumer.id} inbound RTP: packetsReceived=${stat.packetsReceived} bytesReceived=${stat.bytesReceived} framesDecoded=${stat.framesDecoded}`
                                );
                            }
                        });
                    } catch (err) {
                        console.error(
                            `Error getting stats for consumer ${consumer.id}`,
                            err
                        );
                    }
                }, 1000);
            }

            // 8️⃣ Periodically log transport stats to verify packet flow
            console.log('🔍 Setting up transport stats logging...');
            setInterval(async () => {
                try {
                    const stats = await this.recvTransport.getStats();
                    console.log('🔍 recvTransport stats:', stats);
                } catch (err) {
                    console.error('Error getting recvTransport stats', err);
                }
            }, 2000);

            console.log('Debugging info:');
            this.request('debug', {
                streamId,
                rtpCapabilities: this.device.rtpCapabilities,
            });
        });
    }

    /**
     * Helper to emit Socket.IO events and await response
     */
    private request(event: string, data: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.socket.emit(event, data, (res: any) => {
                if (res?.error) reject(res.error);
                else resolve(res);
            });
        });
    }
}
