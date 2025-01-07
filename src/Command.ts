import { Command,CommandEnum,CommandEnumOptions,CommandExecutor,CommandExecutorType,CommandParam,CommandParamDataType, CommandParamType, CommandResult, InternalPermission, Logger, Player } from "../lib";
import { db,PlayerPreference } from "./data";
import { conf } from "./conf";

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
            if (new PlayerPreference(player.uuid,db).data.get("active")) tpa(player);
            else player.tell("您未开启tpa。输入/tpa switch来开启。");
        }
        //指令拒绝
        else if (["deny" ,"refuse","reject","decline","denial","d"].includes(result.params.get("deny")?.value)) {
            if (new PlayerPreference(player.uuid,db).data.get("active")) tpadeny(player);
            else player.tell("您未开启tpa。输入/tpa switch来开启。")
        }
        //tpa设置
        else if (result.params.get("preferences")?.value == "preferences" || result.params.get("preferences")?.value == "p") individualpreferencesform(player);
        //tpahere
        else if (result.params.get("here")?.value == "here" || result.params.get("here")?.value == "h") whethertpa(player,result.params.get("target")?.value,result.params.get("to")?.value=="to","tpahere");
        //tpa开关
        else if (result.params.get("switch")?.value == "switch" || result.params.get("switch")?.value == "switch") {
            //反转active状态
            const currentPreference=new PlayerPreference(player.uuid,db)
            const currentStatus = currentPreference.data.get("active")
            currentPreference.set("active", !currentStatus);
            //反转后为true时发出提示
            if (currentPreference.data.get("active"))player.tell("您已经开启了tpa功能。输入/tpa preferences来调整偏好设置。"); 
            else { player.tell("您已经关闭了tpa功能。输入/tpa switch来重新开启。"); }
        }
        //选择一个仍然有效的请求来接受或拒绝
        else if (result.params.get("here")?.value=="requests"||result.params.get("here")?.value=="r"){sendRequestsForm(player)}
        //tpa
        else {
            whethertpa(player,result.params.get("to")?.value=="to","tpa");
        }
    }
}

class mgrcmd extends Command{
    constructor(){
        super("tpamgr", "管理您的tpa插件","",[
            new CommandParam(CommandParamType.Mandatory,"reload",CommandParamDataType.Enum,new CommandEnum("reload", ["reload"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"log",CommandParamDataType.Enum,new CommandEnum("log", ["log"]),CommandEnumOptions.Unfold),
            new CommandParam(CommandParamType.Mandatory,"info",CommandParamDataType.Enum,new CommandEnum("info", ["conf"]),CommandEnumOptions.Unfold),
        ],[["reload"],["log","info"]],InternalPermission.GameMasters)
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
    }
}

export const maincmdObj=new maincmd()
export const mgrcmdObj=new mgrcmd()