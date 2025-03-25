/**
 * 玩家选择请求目标的表单  
 * 需要注意目前共有两种方法能够让玩家选择目标  
 * 一种是这个表单  
 * 另一个是指令+目标选择器
 * @param {Player} player 请求此选择表单的玩家
 * @param {string} type tpa种类
 */

import { Player ,
    SimpleForm,
    CustomForm,
    CustomFormLabel,
    CustomFormSwitch,
    CustomFormInput,
    SimpleFormSession,
    CustomFormSession,
    CustomFormDropdown,
    SimpleFormButton,
    SimpleFormButtonType,
    Logger,
    ModalFormSession,
    ModalForm
} from "../lib";
import {canOperateRequest, completeRequest, playerIsIgnored, requestExpired, tooOften, TpaType} from "./tp";
import { db, economy, PlayerPreference } from "./data";
import {tpask,cachedRequests,requestsHistory,tpaRequest,fixedTeleport} from "./tp"
import { conf } from "./conf";

export function individualPreferencesForm(player:Player){
    const mode:Array<"自动接受"|"弹窗提醒"|"在聊天中显示"> = ["自动接受","弹窗提醒","在聊天中显示"]
    const preferences=new PlayerPreference(player.uuid,db)
    const fm=new CustomForm(`tpa设置`,[
        new CustomFormLabel("instructions","如果关闭此开关，您将立即拒绝任何tpa请求，且/tpa指令除/tpa preferences外均禁用。您可通过输入/tpa preferences再次启用tpa。"),
        new CustomFormSwitch("active","tpa开关",preferences.data.get("active")),
        new CustomFormDropdown("accept_mode","接收到tpa请求时",mode,preferences.data.get("accept_mode")),
        new CustomFormInput("request_available","tpa请求有效时间/秒","请在此输入一个正整数",(preferences.data.get("request_available")/1000).toString()),
    ],e=>{
        preferences.set({active:e.getSwitch("active").value});
        preferences.set({accept_mode:e.getDropdown("accept_mode").value});
        const request_available_result=checkAndFixRequestAvailableTime(Number(e.getInput("request_available").value))
        preferences.set({request_available:request_available_result.time*1000})
        player.tell(request_available_result.msg)
        player.tell("已保存");
    });
    new CustomFormSession(fm,player).send()
}

function checkAndFixRequestAvailableTime(time:number):{
    time:number,
    success:boolean,
    msg:string
}{
    //此处不赋初始值，强迫typescript检查下面所有的流程控制是否都给msg赋值。要是ts能像rust那样延迟初始化就好了，那样msg就能const了。
    let msg:string
    let success:boolean
    if(Number.isSafeInteger(Number(time))){
        if(time>2147438647){
            msg=(`tpa请求有效时间设置过大，该时间不得超过2147438647秒。已将您的tpa请求有效时间设置为2147438647秒。`)
            time=2147438647;
            success=false
        }
        else if(time==0){
            msg=(`tpa请求有效时间不得设置为0秒，因为这会导致您的请求立即失效。已将您的tpa请求有效时间设置为5秒。`)
            time=5;
            success=false
        }
        else if(time%1!=0){
            msg=(`tpa请求有效时间不能是小数。已将您的tpa请求有效时间设置为${time-time%1}。`)
            time=time-time%1;	
            success=false
            
        }
        else if(time<0){
            msg=(`tpa请求有效时间不能是负数。`)
            if(time < -2147438647)time=2147438647;
            else if(time%1!=0){
                time=time+time%1;
                time*=-1;
            }
            else time=time*-1;
            success=false
        }
        else{
            msg=""
            time=time;
            success=true;
        }
        //time*1000;
    }
    else{
        msg=(`您输入的tpa请求有效时间不完全是数字，无法被识别，请重新进行设置`)
        success=false
    }
    return {
        time,
        success,
        msg
    };
}



export function tpaForm(player:Player,type:TpaType){
    const preference=new PlayerPreference(player.uuid,db)
    let title:string
    switch(type){
        case TpaType.TPA: title="选择要传送到的玩家";break;
        case TpaType.TPAHERE: title="选择要传送过来的玩家";break;
        default:throw new Error("请联系插件开发者为tpa表单处添加处理新tpa类型枚举的实现！")
    }
    const onlinePlayers = Player.getAllOnline();
    const availablePlayers:Player[]=[]
    const buttons:SimpleFormButton[]=[]
    for(let currentPlayer of onlinePlayers){
        //剔掉被忽略的玩家，如假人等、还有自己
        if(!(playerIsIgnored(currentPlayer)||currentPlayer.uuid==player.uuid))availablePlayers.push(currentPlayer);
    }
    for(let currentPlayer of availablePlayers){
        //添加按钮
        buttons.push(new SimpleFormButton(currentPlayer.name,currentPlayer.name,session=>{
            if(preference.data.get("active"))tpask(currentPlayer,player,type);//正式的发送tpa
            else player.tell(`${currentPlayer.name}未开启tpa。`)
        },undefined))
    }
    const fm = new SimpleForm(title,"",buttons)
    if(availablePlayers.length==0){player.tell("当前没有可以和你互传的玩家。");}
    else new SimpleFormSession(fm,player).send()
    
}

/** 
 * 弹窗提醒情况下向tpa目标发起询问的表单
 * @param target 请求目标
 * @param origin 请求发起者
 * @param type tpa种类，可选"tpa"或"tpahere"
 */
export function tpaskForm(origin:Player,target:Player,type:TpaType){
    const preference=new PlayerPreference(origin.uuid,db)
    origin.tell("已经向"+target.name+"发送了弹窗来询问他是否接受这次传送。")
    new SimpleFormSession(new SimpleForm("",type==TpaType.TPA?`${origin.name}希望传送到您这里。`:`${origin.name}希望将您传送至他那里。`,[
        new SimpleFormButton("接受","接受",session=>{
            if(!origin.isOnline()){
                target.tell("找不到发起请求的玩家，他可能已经下线了。")
                return;
            }
            //这里直接新建一个请求用于完成，至于后面会从缓存请求中删除这个请求，删除那步如果缓存中没有，就什么都不会发生
            //这个请求也是需要放到缓存里的，因为后面可能会因为其他原因把这个请求搁置
            const request={origin,target,type,time:new Date()}
            cachedRequests.unshift(request)
            completeRequest(request)
        }),
        new SimpleFormButton("拒绝","拒绝",session=>{
            if(!origin.isOnline()){
                target.tell("找不到发起请求的玩家，他可能已经下线了。")
                return;
            }
            origin.tell(`${target.name}拒绝了您的请求`)
        }),
        new SimpleFormButton("暂存","暂存",session=>{
            if(!origin.isOnline()){
                target.tell("找不到发起请求的玩家，他可能已经下线了。")
                return;
            }
            cachedRequests.unshift({origin,target,type,time:new Date()})
            target.tell(`您已成功缓存了此请求。之后的${preference.data.get("request_available")/1000}内，输入/tpa accept来接受此请求，输入/tpa deny来拒绝此请求`)
            
        })
    ],session=>{
        target.tell("有一个"+origin.name+"发送给您的tpa请求窗口被关闭。如果刚刚没有对您弹窗显示tpa请求，就可能是因为您刚刚打开了部分游戏界面，导致该弹窗未正确显示。您可以输入/tpa accept来接受它，输入/tpa deny来拒绝它，或输入/tpa request来查看目前所有等待处理的tpa请求。")
        origin.tell(`${target.name}设置了弹窗提醒，但弹窗未成功发送。这可能是因为${target.name}关闭了弹窗，或打开了物品栏/其他功能窗口、处于暂停界面、网络卡顿或开启了分屏，或切换至其他窗口。您的请求已暂存，并在${preference.data.get("request_available")/1000}内有效。您可以提醒${target.name}输入/tpa accept接受，或重新发送请求。`);
        cachedRequests.unshift({origin,target,type,time:new Date()})
    }),target).send()
}

/**
 * 向指定玩家发送选择tpa请求的表单
 * @param {Player} player 要发送表单的目标玩家
 */
export function sendRequestsForm(player: Player){
    /**
     * @param {Array<Request>} availableRequests 对于这个玩家目前可用的请求列表
     */
    const availableRequests:tpaRequest[]=[]
    
    for(let request of cachedRequests){
        if(!canOperateRequest(player,request))continue
        availableRequests.push(request);
    }
    //生成并发送表单部分
    const buttons:SimpleFormButton[]=[]
    for(let chosenRequest of availableRequests)buttons.push(new SimpleFormButton(
        chosenRequest.time.getTime().toString(),
        "目的:"
            +(()=>{switch(chosenRequest.type){case TpaType.TPA:return "将他传送到您这里";case TpaType.TPAHERE:return "将您传送到他那里"}})()
            +" 发起者:"
            +chosenRequest.origin.name
            +"\n"
            +Math.floor((new PlayerPreference(chosenRequest.origin.uuid,db).data.get("request_available")-(new Date().getTime()-chosenRequest.time.getTime()))/1000)
            +"秒内有效",
        session=>{
            if(!chosenRequest.origin.isOnline()){
                player.tell("没有找到请求发起者，该玩家可能已经下线。")
                return;
            }
            if(!requestExpired(chosenRequest))sendOperateRequestForm(chosenRequest,session.player)
            else player.tell("您犹豫了太久了，该请求已经过期了。")
        }
    ));
    if(buttons.length==0){
        player.tell("最近没有收到任何tpa请求。")
        return
    }
    new SimpleFormSession(new SimpleForm("选择一个请求","选择一个请求，并决定是否接受",buttons),player).send()
}

export function removeRequest(request:tpaRequest){
    //这里不要直接indexof，因为传入的request可能不存在于cachedRequests里
	cachedRequests.forEach((currentRequest,i)=>{
		if(
            request.origin.uuid==currentRequest.origin.uuid && 
            request.target.uuid==currentRequest.target.uuid && 
            request.time.getTime()==currentRequest.time.getTime()
        )cachedRequests.splice(i,1);
	})
}
/**
 * 完成cachedrequests中的请求后的收尾动作
 * @param {Request} request 此次完成的请求
 */
export function requestDone(request:tpaRequest){
	//requestshistory指令接受
    //在请求历史中压入刚刚执行的请求
    requestsHistory.unshift(request);
    //请求历史的时间表示请求被响应的时间，列表的第一个（索引0）是刚被压入，需要被写入时间的
    requestsHistory[0].time = new Date()
	removeRequest(request)
}

export function sendOperateRequestForm(chosenRequest:tpaRequest,player:Player){
    new SimpleFormSession(new SimpleForm(" ","对玩家"+chosenRequest.origin.name+"向您发起的"+chosenRequest.type+"请求",[
        new SimpleFormButton("接受","接受",()=>{
            if(chosenRequest.origin.uuid==null){player.tell("没有找到请求发起者，该玩家可能已经下线。");return;}
            //注意，completeRequest是异步的
            completeRequest(chosenRequest)
        }),
        new SimpleFormButton("拒绝","拒绝",()=>{
            if(chosenRequest.origin.uuid==null){player.tell("没有找到请求发起者，该玩家可能已经下线。");return;}
            chosenRequest.origin.tell(chosenRequest.target.name+"拒绝了您的请求")
            removeRequest(chosenRequest);
        }),
        new SimpleFormButton("搁置","搁置",()=>{}),
        new SimpleFormButton("丢弃","丢弃",()=>removeRequest(chosenRequest))
    ]),player).send()
}
export function sendSpectatorNotAllowedNortification(player:Player){
    new SimpleFormSession(newOneButtonForm("当前服务器已经禁止在观察者模式下进行玩家互传，请切换至其他游戏模式后再试。"),player).send()
}
function newOneButtonForm(text:string){
    return new SimpleForm("",text,[new SimpleFormButton("确定","确定",()=>{})])
}
export function sendTargetSpectatorNotAllowedNortification(player:Player){
    new SimpleFormSession(newOneButtonForm("对方正处在观察者模式，然而当前服务器已经禁止在观察者模式下进行玩家互传，请等他切换至其他游戏模式后再试。"),player).send()
}
export async function sendTpaHereFlyingWarning(lastSessionOrPlayer:SimpleFormSession | CustomFormSession | ModalFormSession | Player){
    return await new Promise<boolean>(resolve=>{
        new ModalFormSession(new ModalForm(
            "警告","您当前正在飞行！如果现在让其他人传送到您的位置，他很可能在空中坠落，这会对他造成巨量摔落伤害，甚至将其摔死。确认要立即请求他人传送过来吗？",
            //harryxi提到的formapiex中的解决办法
            ()=>setTimeout(()=>resolve(true),0),
            false,
            "确认",
            "取消",
            ()=>setTimeout(()=>resolve(false),0)
        ),lastSessionOrPlayer as any).send()
    })
}
export async function sendTpaFlyingWarning(lastSessionOrPlayer:SimpleFormSession | CustomFormSession | ModalFormSession | Player){
    return await new Promise<boolean>(resolve=>{
        new ModalFormSession(new ModalForm(
            "警告","您当前正在飞行！如果现在让对方传送到您的位置，他很可能在空中坠落，这会对他造成巨量摔落伤害，甚至将其摔死。确认要立即使他传送过来吗？\n若您选择取消，该请求不会被删除或拒绝。您可以点击取消后在安全地点着陆，然后通过/tpa accept接受该请求。",
            //harryxi提到的formapiex中的解决办法
            ()=>setTimeout(()=>resolve(true),0),
            false,
            "确认",
            "取消",
            ()=>setTimeout(()=>resolve(false),0)
        ),lastSessionOrPlayer as any).send()
    })
}
//用于对方飞行中被传送方的确认，目前未采用
export async function sendTargetFlyingWarning(lastSessionOrPlayer:SimpleFormSession | CustomFormSession | ModalFormSession | Player){
    return await new Promise<boolean>(resolve=>{
        new ModalFormSession(new ModalForm(
            "警告","对方当前正在飞行！如果现在传送过去，您很可能在空中坠落，这会对导致您受到巨量摔落伤害，甚至摔死。确认要立即传送过去吗？\n若您选择取消，该请求不会被删除或拒绝。您可以等他在安全地点着陆，然后通过/tpa accept接受该请求。",
            //harryxi提到的formapiex中的解决办法
            ()=>setTimeout(()=>resolve(true),0),
            false,
            "确认",
            "取消",
            ()=>setTimeout(()=>resolve(false),0)
        ),lastSessionOrPlayer as any).send()
    })
}