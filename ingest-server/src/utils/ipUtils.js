import os from "os";

export function getLocalIp() {
    const ifaces = os.networkInterfaces();
    for (const name in ifaces) {
        for (const iface of ifaces[name]) {
            if (iface.family === "IPv4" && !iface.internal)
                return iface.address;
        }
    }
    return "127.0.0.1";
}
