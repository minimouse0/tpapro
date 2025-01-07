import {Logger,InitEvent} from "../lib/index.js";
InitEvent.on((e)=>{
    Logger.info("This Full Moon Platform plugin successfully loaded.");
    return true;
})