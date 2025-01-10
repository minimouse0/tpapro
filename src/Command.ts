import {
    Command,
    CommandEnum, 
    CommandEnumOptions, 
    CommandExecutor, 
    CommandExecutorType, 
    CommandParam, 
    CommandParamDataType, 
    CommandParamType, 
    CommandResult, 
    InternalPermission, 
    Logger, 
    Player
} from "../lib";
import { db,dbloaded,loaddb,PlayerPreference, unloaddb } from "./data";
import { conf } from "./conf";
import { acceptLatestTpaRequest, denyLatestTpaRequest, TpaType, checkTpaConditions } from "./tp";
import { individualPreferencesForm, sendRequestsForm } from "./form";

function tellExecutor(executor:CommandExecutor,msg:string){
    switch(executor.type){
        case CommandExecutorType.Player:executor.object.tell(msg);break;
        case CommandExecutorType.Console:Logger.info(msg);break;
    }
}

class maincmd extends Command{
    constructor(){
        super("tpa","传送至其他玩家，或将其他玩家传送至您这里","",[
            new CommandParam(CommandParamType.Mandatory,"accept",CommandParamDataType.Enum,new CommandEnum("accept",["accept","a"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"preferences",CommandParamDataType.Enum,new CommandEnum("preferences", ["preferences","p"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"here",CommandParamDataType.Enum,new CommandEnum("here", ["here","h"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"deny",CommandParamDataType.Enum,new CommandEnum("deny",["deny","refuse","reject","decline","denial","d"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"switch",CommandParamDataType.Enum,new CommandEnum("switch", ["switch", "s"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"to",CommandParamDataType.Enum,new CommandEnum("to", ["to"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"requests",CommandParamDataType.Enum,new CommandEnum("requests", ["requests","r"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"target",CommandParamDataType.Player),
        ],[[],["to","target"],["accept"],["preferences"],["here"],["here","to","target"],["deny"],["switch"],["requests"]],InternalPermission.Any)
    }   
    callback(result:CommandResult){
        if(!dbloaded){
            tellExecutor(result.executor,"无法进行tpa，因为数据库已被卸载，服务器可能正在进行不停服维护，请联系管理员")
            return
        }
        //首先判断是否是玩家，不是玩家就放弃执行
        switch(result.executor.type){
            //是玩家，直接继续
            case CommandExecutorType.Player:break;
            //是控制台，发出提示
            case CommandExecutorType.CommandBlock:Logger.error("无法以控制台身份执行tpa命令，控制台是无法被传送进游戏里的")
            //不是玩家，放弃执行回调
            default:return;
        }
        const player:Player=result.executor.object
        //指令接受
        if (result.params.get("accept")?.value == "accept" || result.params.get("accept")?.value == "a") {//指令接受
            if (new PlayerPreference(player.uuid,db).data.get("active")) acceptLatestTpaRequest(player);
            else player.tell("您未开启tpa。输入/tpa switch来开启。");
        }
        //指令拒绝
        else if (["deny" ,"refuse","reject","decline","denial","d"].includes(result.params.get("deny")?.value)) {
            if (new PlayerPreference(player.uuid,db).data.get("active")) denyLatestTpaRequest(player);
            else player.tell("您未开启tpa。输入/tpa switch来开启。")
        }
        //tpa设置
        else if (result.params.get("preferences")?.value == "preferences" || result.params.get("preferences")?.value == "p") individualPreferencesForm(player);
        //tpahere
        else if (result.params.get("here")?.value == "here" || result.params.get("here")?.value == "h") checkTpaConditions(player,result.params.get("target")?.value,result.params.get("to")?.value=="to",TpaType.TPAHERE);
        //tpa开关
        else if (result.params.get("switch")?.value == "switch" || result.params.get("switch")?.value == "s") {
            //反转active状态
            const currentPreference=new PlayerPreference(player.uuid,db)
            const currentStatus = currentPreference.data.get("active")
            currentPreference.set({active:!currentStatus});
            //反转后为true时发出提示
            currentPreference.reload()
            if (currentPreference.data.get("active"))player.tell("您已经开启了tpa功能。输入/tpa preferences来调整偏好设置。"); 
            else { player.tell("您已经关闭了tpa功能。输入/tpa switch来重新开启。"); }
        }
        else if (result.params.get("requests")?.value == "requests" || result.params.get("requests")?.value == "r"){sendRequestsForm(player)}//选择一个仍然有效的请求来接受或拒绝
        //选择一个仍然有效的请求来接受或拒绝
        else if (result.params.get("here")?.value=="requests"||result.params.get("here")?.value=="r"){sendRequestsForm(player)}
        //tpa
        else {
            checkTpaConditions(player,result.params.get("target")?.value,result.params.get("to")?.value=="to",TpaType.TPA);
        }
    }
}

class mgrcmd extends Command{
    constructor(){
        super("tpamgr", "管理您的tpa插件","",[
            new CommandParam(CommandParamType.Mandatory,"reload",CommandParamDataType.Enum,new CommandEnum("reload", ["reload"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"log",CommandParamDataType.Enum,new CommandEnum("log", ["log"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"info",CommandParamDataType.Enum,new CommandEnum("info", ["conf"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"dev",CommandParamDataType.Enum,new CommandEnum("dev", ["dev"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"db",CommandParamDataType.Enum,new CommandEnum("db", ["db"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"unload",CommandParamDataType.Enum,new CommandEnum("unload", ["unload"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"load",CommandParamDataType.Enum,new CommandEnum("load", ["load"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"exe",CommandParamDataType.Enum,new CommandEnum("exe", ["exe"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"devoptions",CommandParamDataType.String),
            new CommandParam(CommandParamType.Mandatory,"dbcmd",CommandParamDataType.Message)
        ],[["reload"],["log","info"],["dev","devoptions"],["db","exe","dbcmd"],["db","unload"],["db","load"]],InternalPermission.GameMasters)
    }
    callback(result: CommandResult): void {
        if (result.params.get("reload")?.value == "reload") {
            if (conf.reload()) {
                tellExecutor(result.executor,"配置文件重载完成")
            } else {
                tellExecutor(result.executor,"无法重载配置文件")
            }
            /*
            if (individualpreferences.reload()) {
                RefreshPrefIndexCache()
                if (origin.type == 0) {
                    origin.player.tell("玩家偏好数据文件重载完成");
                } else if (origin.type == 7) {
                    Logger.info("玩家偏好数据文件重载完成");
                }
            } 
            else {
                if (origin.type == 0) {
                    origin.player.tell("无法重载玩家偏好数据文件");
                } else if (origin.type == 7) {
                    Logger.info("无法重载玩家偏好数据文件");
                }
            }*/
        }
        else if (result.params.get("log")?.value == "log") {//调试信息
            switch (result.params.get("info")?.value) {
                case "conf": {
                    tellExecutor(result.executor,conf.reload().toString());
                    break;
                }
            }
        }
        else if (result.params.get("dev")?.value=="dev"){
            switch(result.params.get("devoptions")?.value){
            }
        }
        else if(result.params.get("db")?.value=="db"){
            if(result.params.get("unload")?.value=="unload")if(unloaddb())tellExecutor(result.executor,"数据库已卸载。卸载后插件大部分功能都将不可用，要想重新加载数据库，请执行/tpamgr db load")
            if(result.params.get("load")?.value=="load")if(loaddb())tellExecutor(result.executor,"数据库加载成功")
            if(result.params.get("dbcmd")?.value){
                const cmd=result.params.get("dbcmd")?.value
                tellExecutor(result.executor,cmd)
                tellExecutor(result.executor,JSON.stringify(db.queryAllSync(cmd),undefined,4))
            }
        }
    }
}

export const maincmdObj=new maincmd()
export const mgrcmdObj=new mgrcmd()