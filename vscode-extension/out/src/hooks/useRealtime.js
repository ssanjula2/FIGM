"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useRealtime = useRealtime;
const react_1 = require("react");
const realtime_service_1 = require("../storage/realtime-service");
function useRealtime(eventType, initialData) {
    const [data, setData] = (0, react_1.useState)(initialData);
    const [lastUpdated, setLastUpdated] = (0, react_1.useState)(new Date().toISOString());
    (0, react_1.useEffect)(() => {
        const unsubscribe = realtime_service_1.realtimeService.subscribe(eventType, (payload) => {
            setData(payload);
            setLastUpdated(new Date().toISOString());
        });
        return () => {
            unsubscribe();
        };
    }, [eventType]);
    return { data, lastUpdated };
}
//# sourceMappingURL=useRealtime.js.map