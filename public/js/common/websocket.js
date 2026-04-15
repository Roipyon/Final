class WSClient {
    constructor(userId) {
        this.userId = userId;
        this.ws = null;
        this.reconnectTimer = null; // 重连定时器
        this.listeners = new Map();
        this.connect();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        this.ws = new WebSocket(`${protocol}//${host}?userId=${this.userId}`);

        this.ws.onopen = () => {
            console.log('WebSocket 已连接');
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                const handlers = this.listeners.get(msg.type) || [];
                handlers.forEach(fn => fn(msg.data));
            } catch (e) {
                console.error('消息解析失败', e);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket 断开，5秒后重连');
            this.reconnectTimer = setTimeout(() => this.connect(), 5000);
        };

        this.ws.onerror = (err) => {
            console.error('WebSocket 错误', err);
        };
    }

    on(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type).push(callback);
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
}

export { WSClient };