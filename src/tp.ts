import { Player,Location, ModalFormSession, ModalForm } from "../lib";
import { conf } from "./conf";
import { AcceptMode, db,economy,getPlayerAcceptMode,PlayerPreference } from "./data";
import { tpaForm, tpaskForm } from "./form";

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
        //检测是否已经下线
		if(!cachedRequest.origin.isOnline())continue;
        //如果请求的接受者是这个玩家，且请求未过期
        //这里的请求过期是指请求的有效时间，而不是指请求的缓存时间
		if(cachedRequest.target.uuid==player.uuid &&
            //检测请求是否过期
            new Date().getTime()-cachedRequest.time.getTime()<=new PlayerPreference(cachedRequest.origin.uuid,db).data.get("uuid").requestavailable
        ){
            //做完当前请求
            completeRequest(cachedRequest);
            cachedRequests.splice(cachedRequests.indexOf(cachedRequest),1);
            norequests = false;
            break;
		}
	}
	if(norequests==true){player.tell(`最近没有收到任何tpa请求。`);}
}

/**
 * 将一个请求做完，包括传送、扣费、记录
 * @param request 要完成的请求
 */
export function completeRequest(request:tpaRequest){

    //这个缓存的请求是tpa还是tpahere
    switch(request.type){
        case TpaType.TPA:fixTeleport(request.origin,request.target.location)
        case TpaType.TPAHERE:fixTeleport(request.target,request.origin.location)
    }
    if (tooOften(request.origin)) economy.reduce(request.origin.uuid, conf.get("frequency_limit").limit_price);//频繁价格
    //requestshistory指令接受
    //在请求历史中压入刚刚执行的请求
    requestsHistory.unshift(request);
    //请求历史的时间表示请求被响应的时间，列表的第一个（索引0）是刚被压入，需要被写入时间的
    requestsHistory[0].time = new Date()
    //按基础价格进行扣款
    economy.reduce(request.origin.uuid, conf.get("economy").price);
    //记得写经济是否充足
    //如果玩家经济不充足会被直接拒绝
    //如果玩家经济充足才会进到这里然后被扣钱
    //从缓存的请求中删除当前请求，我知道为什么要用i了，因为我需要从数组中定位现在这个请求，然后好删除它

}


/** 
 * 向tpa目标发起询问  
 *   
 * tpa发起后，共有三种方式，一种是自动接受，直接在tpask里面，一种是弹窗提醒，在tpaskForm里面，一种是指令接受，要从指令开始找
 * @param player 请求目标
 * @param origin 请求发起者
 * @param type tpa种类，可选"tpa"或"tpahere"
 */
export function tpask(player:Player,origin:Player,type:TpaType){
    const preference=new PlayerPreference(player.uuid,db)
    //触发其他插件事件
    //if(!tpaAskEvent.exec(player,origin,type)){return;}
    switch(getPlayerAcceptMode(preference)){
        //弹窗提醒
        case AcceptMode.Form:tpaskForm(origin, player, type);break;
        case AcceptMode.Command:{//指令接受
            switch(type) {
                case TpaType.TPA:player.tell(`${origin.name}希望传送到您这里。`);break;
                case TpaType.TPAHERE:player.tell(`${origin.name}希望将您传送至他那里。`);break;
            }
            player.tell(`输入/tpa accept接受，输入/tpa deny拒绝。`);
            player.tell(`输入/tpa preferences来管理此通知。`)
            origin.tell(`由于${player.name}未设置弹窗提醒，对方输入指令同意前，您的请求将有效${preference.data.get("request_available")/1000}秒。你可通过/tpa preferences调整有效时间。`)
            cachedRequests.unshift({origin:origin,target:player,type:type,time:new Date()})
            break;
        }
        case AcceptMode.Auto:{//自动接受
            switch(type){
                case TpaType.TPA:fixTeleport(origin,player.location);break;
                case TpaType.TPAHERE:fixTeleport(player,origin.location);break;
            }
            if (tooOften(origin)) economy.reduce(origin.uuid, conf.get("frequency_limit").limit_price);//频繁价格
            requestsHistory.unshift({ origin: origin, target: player, type: type, time: new Date()});
            economy.reduce(origin.uuid, conf.get("economy").price);
            break;
        }
    }
}


export function tpadeny(player:Player){
    const preference=new PlayerPreference(player.uuid,db)
	let norequests=true;
	for(let request of cachedRequests){
		if(request.origin.uuid==null){
			continue;
		}
		if(request.target.uuid==player.uuid&&
            new Date().getTime()-request.time.getTime()<=preference.data.get("request_available")){
			request.origin.tell(`${request.target.name}拒绝了您的请求`)
			cachedRequests.splice(cachedRequests.indexOf(request),1);
			norequests=false;
			break;
		}
	}
	if(norequests==true){player.tell(`最近没有任何可以拒绝的tpa请求。`);}
}

function denyLatestTpaRequest(player:Player){
    const preference=new PlayerPreference(player.uuid,db)
    let norequests=true;
    for(let cachedRequest of cachedRequests){
        //检测是否已经下线
        if(!cachedRequest.origin.isOnline())continue;
        if( cachedRequest.target.uuid == player.uuid&&new Date().getTime()-cachedRequest.time.getTime()
            <=
        preference.data.get("requestavailable")
        ){
            cachedRequest.origin.tell(`${cachedRequest.target.name}拒绝了您的请求`)
            cachedRequests.splice(cachedRequests.indexOf(cachedRequest),1);
            norequests=false;
            break;
        }
    }
    if(norequests)player.tell(`最近没有任何可以拒绝的tpa请求。`);
}
function checkTpaConditions(origin:Player,targetarr:Player[],to:boolean,type:TpaType){
    //执行tpa或tpahere
    if (to) {
        if (targetarr.length==0) origin.tell("没有匹配的对象");
        else if(targetarr.length>1) origin.tell("您选中了多个玩家，无法确定您究竟要传送哪位玩家。这很可能是由于您使用了可选择多个玩家的目标选择器，如@a、@e等。请调整目标选择器的参数，让其只能选中一个玩家。");
        else tpask(targetarr[0], origin,type);//玩家已经在指令中给出了tpa的对象，直接发送请求
    }
    else tpaForm(origin,type);//让玩家选择tpa的对象。最终目标也是tpask()
}
export function whethertpa(origin:Player,targetarr:Player[],to:boolean,type:TpaType){
    const preference=new PlayerPreference(origin.uuid,db)
    if (!preference.data.get("active")){
        origin.tell("您未开启tpa。输入/tpa switch来开启。")
        return
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
    checkTpaConditions(origin,targetarr,to,type);
}

function sendPayForFrequentlyTPForm(player:Player,targets:Player[],to:boolean,type:TpaType){
    new ModalFormSession(new ModalForm(
        "发送tpa请求过于频繁",
        `发送tpa请求过于频繁！暂时您需要花费${conf.get("frequency_limit").limit_price + conf.get("economy").price}${conf.get("economy").name}才能继续传送。`,
        session=>{
            if (economy.get(player.uuid) < conf.get("economy").price + conf.get("frequency_limit").limit_price) {
                player.tell("您的余额不足");
            } else {
                //执行tpa
                checkTpaConditions(player,targets,to,type);
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
	if(player.isSimulated())return true;
	return false;
}

export function fixTeleport(player:Player,pos:Location){
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
