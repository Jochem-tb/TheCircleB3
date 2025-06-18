// src/app/mediasoup.service.ts
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

    async initStream(streamId: string, videoElement: HTMLVideoElement) {
        // 1️⃣ Connect to Socket.IO
        console.log('🔗 Connecting to mediasoup server...');
        this.socket = io('http://localhost:8090', {
            transports: ['websocket'],
        });
        this.socket.on('connect', async () => {
            console.log('✅ Connected to mediasoup server');

            // 2️⃣ Load the mediasoup Device with server RTP caps
            console.log('📦 Loading mediasoup Device...');
            this.device = new Device();
            const routerRtpCapabilities = await this.request(
                'getRouterRtpCapabilities',
                { streamId }
            );
            await this.device.load({ routerRtpCapabilities });
            console.log('📦 Device loaded successfully');

            // 3️⃣ Create recv transport on server
            console.log('🚚 Creating recv transport...');
            const { id, iceParameters, iceCandidates, dtlsParameters } =
                await this.request('joinStream', {
                    streamId,
                    rtpCapabilities: this.device.rtpCapabilities,
                });

            this.recvTransport = this.device.createRecvTransport({
                id,
                iceParameters,
                iceCandidates,
                dtlsParameters,
            });
            console.log(
                `🚚 Recv transport created with ID: ${this.recvTransport.id}`
            );

            // 4️⃣ Signal DTLS connect
            console.log('🔒 Connecting recv transport...');
            this.recvTransport.on(
                'connect',
                ({ dtlsParameters }, callback, errback) => {
                    this.socket.emit(
                        'connectTransport',
                        { transportId: id, dtlsParameters },
                        (res: string) =>
                            res === 'connected'
                                ? callback()
                                : errback(new Error(res))
                    );
                }
            );
            this.recvTransport.on('connectionstatechange', (state) => {
                console.log(`🔗 Transport state changed: ${state}`);
                if (state === 'connected') {
                    console.log('✅ Transport connected');
                } else if (state === 'failed') {
                    console.error('❌ Transport connection failed');
                }
            });

            // 5️⃣ Ask server to create consumers
            console.log('👀 Requesting consumer infos...');
            const consumerInfos: Array<{
                id: string;
                producerId: string;
                kind: 'audio' | 'video';
                rtpParameters: any;
            }> = await this.request('consume', {
                streamId,
                rtpCapabilities: this.device.rtpCapabilities,
            });
            if (!consumerInfos || consumerInfos.length === 0) {
                console.error('❌ No consumers found for this stream');
                return;
            }

            // 6️⃣ Create each consumer locally, attach track
            console.log('🎥 Creating consumers...');
            for (const info of consumerInfos) {
                const consumer = await this.recvTransport.consume({
                    id: info.id,
                    producerId: info.producerId,
                    kind: info.kind,
                    rtpParameters: info.rtpParameters,
                });
                this.consumers.push(consumer);

                this.ngZone.runOutsideAngular(() => {
                    if (consumer.kind === 'video') {
                        const stream = new MediaStream([consumer.track]);
                        videoElement.srcObject = stream;
                        videoElement.muted = true;
                        videoElement.play().catch(console.error);
                    }
                });

                // 7️⃣ Resume so server starts sending
                console.log(
                    `▶️ Resuming consumer ${info.id} (${info.kind})...`
                );
                await this.request('resume', { consumerId: consumer.id });
            }
        });
    }

    private request(event: string, data: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.socket.emit(event, data, (res: any) => {
                if (res?.error) reject(res.error);
                else resolve(res);
            });
        });
    }
}
