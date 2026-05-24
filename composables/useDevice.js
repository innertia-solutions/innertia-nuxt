import { onMounted } from 'vue';

export const useDevice = () => {
    const getDeviceId = () => {
        if (process.server) return null;
        
        let deviceId = localStorage.getItem('app_device_id');
        
        if (!deviceId) {
            // Generate a random UUID-like string
            deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('app_device_id', deviceId);
        }
        
        return deviceId;
    };

    return {
        getDeviceId
    };
};
