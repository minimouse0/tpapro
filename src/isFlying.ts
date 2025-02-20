import { Player, TickEvent } from "../lib";
const playerInAirRecord=new Map<string,boolean[]>()
TickEvent.on(e=>{
    
    for(let player of Player.getAllOnline()){
        if(playerInAirRecord.get(player.uuid)==undefined)playerInAirRecord.set(player.uuid,[])
        const records=playerInAirRecord.get(player.uuid)
        if(records==undefined)throw new Error("未能成功记录玩家"+player.uuid+"的腾空记录，请联系开发者")
        records.unshift(player.inAir)
        if(records.length>60)records.pop()
    }
})
export function playerIsFlying(uuid:string){
    const records=playerInAirRecord.get(uuid)
    if(records==undefined)return false
    if(records.length>=60){
        for(let record of records){
            if(!record){
                return false
            }
        }
        return true
    }
    return false
}