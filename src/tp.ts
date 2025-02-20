import { Player,Location, ModalFormSession, ModalForm, Logger, GameMode } from "../lib";
import { conf } from "./conf";
import { AcceptMode, db,economy,getPlayerAcceptMode,PlayerPreference } from "./data";
import { removeRequest, requestDone, sendSpectatorNotAllowedNortification, sendTargetFlyingWarning, sendTargetSpectatorNotAllowedNortification, sendTpaFlyingWarning, sendTpaHereFlyingWarning, tpaForm, tpaskForm } from "./form";
import { playerIsFlying } from "./isFlying";

export enum TpaType{
    TPA,
    TPAHERE
}

export interface tpaRequest{
    /**发起者 */
    origin:Player,
    /**接受者 */
    target:Player,
    /**通过这个判断发起和接受 */
    type:TpaType,
    /**请求被**缓存**的时间，用于检查请求是否过期，以1970年1月1日以来的毫秒数计 */
    time:Date
}

export const cachedRequests:tpaRequest[] = [];
export const requestsHistory:tpaRequest[] = [];
/**
 * 只有从缓存中读取请求时才会调用这个函数，缓存中标明了是tpa还是tpahere，所以即使是tpahere，也会用这个函数传送
 * 此函数只是接受。一个传送请求的接受是一步，做完是一步
 * @param player tpa的请求者
 */
export function acceptLatestTpaRequest(player:Player){
	let norequests=true;
    //遍历已有请求寻找属于该玩家的已缓存请求
	for(let cachedRequest of cachedRequests){
        //检测是否已经下线，此处不做任何处理，因为要顺到下一位请求来接受
        //如果请求的接受者是这个玩家，且请求未过期
        //这里的请求过期是指请求的有效时间，而不是指请求的缓存时间
		if(!canOperateRequest(player,cachedRequest))continue
        
        //做完当前请求
        //注意，completeRequest是异步的
        //但是这里没用等待completeRequest完成，因为后续代码并不需要等待它修改什么东西
        completeRequest(cachedRequest);
        norequests = false;
        break;
	}
	if(norequests==true){player.tell(`最近没有收到任何tpa请求。`);}
}

/**
 * 将一个请求做完，包括传送、扣费、记录
 * 在请求做完之前可以随时打断它
 * @param request 要完成的请求
 */
export async function completeRequest(request:tpaRequest){
    //如果请求是tpa，且自己在高空中，证明传送过来是危险的
    if(request.type==TpaType.TPA&&playerIsFlying(request.target.uuid)&&
        (request.origin.gameMode==GameMode.Survival||request.origin.gameMode==GameMode.Adventure)
    ){
        //对方不是自动接受的话向对方发送提示，是自动接受的话向自己发送提示
        if(getPlayerAcceptMode(new PlayerPreference(request.target.uuid,db))!=AcceptMode.Auto){
            if(!await sendTpaFlyingWarning(request.target))return;
        }
        else{
            if(!await sendTargetFlyingWarning(request.origin))return;
        }
    }
    //这个缓存的请求是tpa还是tpahere
    switch(request.type){
        case TpaType.TPA:fixedTeleport(request.origin,request.target.location);break;
        case TpaType.TPAHERE:fixedTeleport(request.target,request.origin.location);break;
    }
    if (tooOften(request.origin)) {
        economy.reduce(request.origin.uuid, conf.get("frequency_limit").limit_price);//频繁价格
    }				
    economy.reduce(request.origin.uuid, conf.get("economy").price);//基础价格
    requestDone(request)
    //记得写经济是否充足
    //如果玩家经济不充足会被直接拒绝
    //如果玩家经济充足才会进到这里然后被扣钱
    //从缓存的请求中删除当前请求，我知道为什么要用i了，因为我需要从数组中定位现在这个请求，然后好删除它

}


/** 
 * 向tpa目标发起询问  
 *   
 * tpa发起后，共有三种方式，一种是自动接受，直接在tpask里面，一种是弹窗提醒，在tpaskForm里面，一种是指令接受，要从指令开始找
 * @param target 请求目标
 * @param origin 请求发起者
 * @param type tpa种类，可选"tpa"或"tpahere"
 */
export async function tpask(target:Player,origin:Player,type:TpaType){
    const preference=new PlayerPreference(target.uuid,db)
    //如果对方处于观察者模式，就直接放弃传送
    if(!conf.get("allow_spc_tp")&&target.gameMode==GameMode.Spectator){
        sendTargetSpectatorNotAllowedNortification(origin)
        target.tell(origin.name+"正打算与您互传，然而您正处于观察者模式下。由于服务器设置了禁止玩家们在观察者模式下互传，他目前无法继续与您互传。如果接受来自他人的互传请求，请修改为其他游戏模式，然后让他们再试一次。")
        return;
    }
    
    //如果是tpahere而且自己正在飞行，那么发出警告
    //tpahere的时候只有对方处于容易摔死的游戏模式才发出警告
    //因为这个地方需要等待，所以整个函数改了异步
    if(type==TpaType.TPAHERE&&playerIsFlying(origin.uuid)&&
        (target.gameMode==GameMode.Survival||target.gameMode==GameMode.Adventure)
    ){
        if(!await sendTpaHereFlyingWarning(origin))return;
    }
    //触发其他插件事件
    //if(!tpaAskEvent.exec(player,origin,type)){return;}
    switch(getPlayerAcceptMode(preference)){
        //弹窗提醒
        case AcceptMode.Form:tpaskForm(origin, target, type);break;
        //指令接受
        case AcceptMode.Command:{
            switch(type) {
                case TpaType.TPA:target.tell(`${origin.name}希望传送到您这里。`);break;
                case TpaType.TPAHERE:target.tell(`${origin.name}希望将您传送至他那里。`);break;
            }
            target.tell(`输入/tpa accept接受，输入/tpa deny拒绝。`);
            target.tell(`输入/tpa preferences来管理此通知。`)
            origin.tell(`由于${target.name}未设置弹窗提醒，对方输入指令同意前，您的请求将有效${preference.data.get("request_available")/1000}秒。你可通过/tpa preferences调整有效时间。`)
            cachedRequests.unshift({origin,target:target,type,time:new Date()})
            break;
        }
        case AcceptMode.Auto:{//自动接受
            completeRequest({origin,target,type,time:new Date()})
            break;
        }
    }
}


export function denyLatestTpaRequest(player:Player){
	let norequests=true;
	for(let cachedRequest of cachedRequests){
		if(!canOperateRequest(player,cachedRequest))continue

        cachedRequest.origin.tell(`${cachedRequest.target.name}拒绝了您的请求`)
        cachedRequests.splice(cachedRequests.indexOf(cachedRequest),1);
        norequests=false;
        break;
	}
	if(norequests==true){player.tell(`最近没有任何可以拒绝的tpa请求。`);}
}
function newTpaFromCmdResult(origin:Player,targetarr:Player[],to:boolean,type:TpaType){
    //执行tpa或tpahere
    if (to) {
        if (targetarr.length==0) origin.tell("没有匹配的对象");
        else if(targetarr.length>1) origin.tell("您选中了多个玩家，无法确定您究竟要传送哪位玩家。这很可能是由于您使用了可选择多个玩家的目标选择器，如@a、@e等。请调整目标选择器的参数，让其只能选中一个玩家。");
        else if(!new PlayerPreference(targetarr[0].uuid,db).data.get("active")) origin.tell("玩家"+targetarr[0].name+"关闭了tpa功能。当前他似乎不欢迎其他人向他发起tpa请求。")
        else if(targetarr[0].uuid==origin.uuid) origin.tell("不能向自己发送传送请求。")
        //玩家已经在指令中给出了tpa的对象，直接发送请求
        else tpask((()=>{const player=Player.getOnlinePlayer(targetarr[0].uuid);if(player==undefined){throw new Error("错误202501100246，请联系作者")}return player})(), origin,type);
    }
    else tpaForm(origin,type);//让玩家选择tpa的对象。最终目标也是tpask()
}
export function checkTpaConditions(origin:Player,targetarr:Player[],to:boolean,type:TpaType){
    const preference=new PlayerPreference(origin.uuid,db)
    if (!preference.data.get("active")){
        origin.tell("您未开启tpa。输入/tpa switch来开启。")
        return
    }
    //如果自己正处于观察者模式，就禁止玩家进行传送
    if(!conf.get("allow_spc_tp")&&origin.gameMode==GameMode.Spectator){
        sendSpectatorNotAllowedNortification(origin)
        return;
    }
    //tpa
    //vip专属逻辑、tpa禁区可以直接写在前面这里
    //目前vip需要折扣、免费、不受频率限制，频繁后不加价或加价部分折扣
    //vip的扣费还是需要写在后面，这里只写检查余额
    if (conf.get("frequency_limit").active && 
        tooOften(origin) && conf.get("frequency_limit").limit_price > 0
    ) {//频繁且付费
        //频繁后可以付费
        //特殊位置，单独写一份
        sendPayForFrequentlyTPForm(origin,targetarr,to,type)
        return
    }
    else if (conf.get("frequency_limit").active && tooOften(origin) && conf.get("frequency_limit").limit_price <= 0) {
        origin.tell("发送tpa请求过于频繁，请稍后再试");
        return 
    }
    //在这里加上黑白名单判断
    if (economy.get(origin.uuid) < conf.get("economy").price && conf.get("economy").price > 0) {
        origin.tell(`您的余额不足，本服务器中tpa传送需花费${conf.get("economy").price}${conf.get("economy").name}`);
        return
    }
    //执行tpa
    newTpaFromCmdResult(origin,targetarr,to,type);
}

function sendPayForFrequentlyTPForm(player:Player,targets:Player[],to:boolean,type:TpaType){
    new ModalFormSession(new ModalForm(
        "发送tpa请求过于频繁",
        `发送tpa请求过于频繁！暂时您需要花费${conf.get("frequency_limit").limit_price + conf.get("economy").price}${conf.get("economy").name}才能继续传送。`,
        ()=>{
            if (economy.get(player.uuid) < conf.get("economy").price + conf.get("frequency_limit").limit_price) {
                player.tell("您的余额不足");
            } else {
                //执行tpa
                newTpaFromCmdResult(player,targets,to,type);
            }
        },false,"继续","取消"
    ),player)
}


const playersNotIgnored:Player[]=[];
/**
 * 检查玩家是否要被忽略
 * @param {Player} player 要检查的玩家
 * @returns 是否被忽略
 */
export function playerIsIgnored(player: Player){
	for(let currentPlayer of playersNotIgnored)if(player.uuid==currentPlayer.uuid)return false;
	if(playerUnableToTpa(player))return true;
    if(!new PlayerPreference(player.uuid,db).data.get("active"))return true
	return false;
}
export function playerUnableToTpa(player:Player){
    if(player.isSimulated())return true;
}

export function fixedTeleport(player:Player,pos:Location){
    /*
    let target=pos;
    let threatBlock=mc.getBlock(pos.x-1,pos.y+1,pos.z-1,pos.dimension);
    if(!threatBlock.isAir){
        target=new Location(pos.x,pos.y-1.5,pos.z,pos.dimension)
    }*/
   //现在满月平台是按脚部传送玩家的，不会卡人，所以此处无需修复
    player.teleport(pos);
}
/**
 * 
 * @param {Player} player 要判断是否频繁的玩家
 * @returns 是否频繁
 */
export function tooOften(player: Player) {//判断是否频繁传送
    let times=0
    //遍历请求历史，将总数相加
    for (let request of requestsHistory) {
        if (player.uuid == request.origin.uuid) times++;
        //对于当前请求来说，这最后一次传送的时间还时间限制内，但是传送总数已经超过了最大限制，证明达到了设定的限制
        if (times >= conf.get("frequency_limit").requests_limit && 
            new Date().getTime() - request.time.getTime()<= conf.get("frequency_limit").time_limit
        ) return true;
    }
    return false;
}

export function requestAvailable(request:tpaRequest):boolean{
    if(!(request.origin.isOnline()&&request.target.isOnline()))return false
    if(requestExpired(request))return false
    return true;
}

export function requestExpired(request:tpaRequest):boolean{
    return new Date().getTime()-request.time.getTime()>new PlayerPreference(request.origin.uuid,db).data.get("request_available")
}

/**
 * 检查一个玩家是否能够接受或拒绝一个指定的请求
 * @param player 要操作一个请求的玩家
 * @param request 要检查的请求
 * @returns 该请求是否能被该玩家操作
 */
export function canOperateRequest(player:Player,request:tpaRequest):boolean{
    return request.target.uuid==player.uuid&&requestAvailable(request)
}