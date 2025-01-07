/**
 * 玩家选择请求目标的表单  
 * 需要注意目前共有两种方法能够让玩家选择目标  
 * 一种是这个表单  
 * 另一个是指令+目标选择器
 * @param {Player} player 请求此选择表单的玩家
 * @param {string} type tpa种类
 */

function individualpreferencesform(player){
    let fm=mc.newCustomForm();
    let preferences;
    fm.setTitle(`tpa设置`);
    let mode = ["自动接受","弹窗提醒","在聊天中显示"]
    fm.addLabel("如果关闭此开关，您将立即拒绝任何tpa请求，且/tpa指令除/tpa preferences外均禁用。您可通过输入/tpa preferences再次启用tpa。")
    fm.addSwitch("tpa开关",individualpreferences.get("preferences")[getIFromPref(player.uuid)].active);
    fm.addDropdown("接收到tpa请求时",mode,individualpreferences.get("preferences")[getIFromPref(player.uuid)].acceptmode)
    fm.addInput("tpa请求有效时间/秒"," ",(individualpreferences.get("preferences")[getIFromPref(player.uuid)].requestavailable/1000).toString())//
    player.sendForm(fm,function (player,data){
        if(data!=null){
            let write = individualpreferences.get("preferences");
            preferences=write[getIFromPref(player.uuid)];
            //开始对特定玩家的数据执行更改
            preferences.active=data[1];
            preferences.acceptmode=data[2];
            let requestavailableinput=120;
            if(Number.isSafeInteger(Number(data[3]))){
                if(data[3]>2147438647){
                    player.tell(`tpa请求有效时间设置过大，该时间不得超过2147438647秒。已将您的tpa请求有效时间设置为2147438647秒。`)
                    requestavailableinput=2147438647;
                }
                else if(data[3]==0){
                    player.tell(`tpa请求有效时间不得设置为0秒，因为这会导致您的请求立即失效。已将您的tpa请求有效时间设置为5秒。`)
                    requestavailableinput=5;
                }
                else if(data[3]%1!=0){
                    player.tell(`tpa请求有效时间不能是小数。已将您的tpa请求有效时间设置为${data[3]-data[3]%1}。`)
                    requestavailableinput=data[3]-data[3]%1;	
                    
                }
                else if(data[3]<0){
                    player.tell(`tpa请求有效时间不能是负数。`)
                    if(data[3]<-2147438647){
                        requestavailableinput=2147438647;
                    }
                    else if(data[3]%1!=0){
                        requestavailableinput=data[3]+data[3]%1;
                        requestavailableinput*=-1;
                    }
                    else{
                        requestavailableinput=data[3]*-1;
                    }
                }
                else{
                    requestavailableinput=data[3];
                }
                preferences.requestavailable=requestavailableinput*1000;
            }
            else{
                player.tell(`您输入的tpa请求有效时间不完全是数字。已将您的tpa请求有效时间设置为${conf.get("default_preferences").requestavailable/1000}秒。`)
                preferences.requestavailable=conf.get("default_preferences").requestavailable
                
            }
            //更改特定玩家的数据结束，开始写入
            write[getIFromPref(player.uuid)]=preferences;
            individualpreferences.set("preferences",write);
            RefreshPrefIndexCache()
            individualpreferences.reload();
            player.tell("已保存");
        }
    })
}

/** 
 * 弹窗提醒情况下向tpa目标发起询问的表单
 * @param {Player} player 请求目标
 * @param {Player} origin 请求发起者
 * @param {string} type tpa种类，可选"tpa"或"tpahere"
 */
function tpaskform(origin,target,type){
    let fm=mc.newSimpleForm();
    fm.addButton("接受")
    fm.addButton("拒绝")
    fm.addButton("暂存")
    if(type=="tpa"){
        fm.setContent(`${origin.name}希望传送到您这里。`)
        target.sendForm(fm,function(player,id){
            if(origin.uuid==null){
                target.tell("找不到发起请求的玩家，他可能已经下线了。")
                return;
            }
            if (id == 0) {
                fixTeleport(origin,target.pos)
                //弹窗接受的tpa
                if (toooften(origin)) {
                    economy.reduce(origin, conf.get("frequency_limit").limit_price);//频繁价格
                }
                requestshistory.unshift({ origin: origin, target: target, type: type, time: new Date().getTime() });
                economy.reduce(origin, conf.get("economy").price);
            }
            else if(id==1){origin.tell(`${target.name}拒绝了您的请求`)}
            else if(id==2){
                cachedrequests.unshift({origin:origin,target:target,type:type,time:new Date().getTime()})
                target.tell(`您已成功缓存了此请求。之后的${individualpreferences.get("preferences")[getIFromPref(origin.uuid)].requestavailable/1000}内，输入/tpa accept来接受此请求，输入/tpa deny来拒绝此请求`)
            }
            else{
                origin.tell(`${target.name}设置了弹窗提醒，但弹窗未成功发送。这可能是因为${target.name}关闭了弹窗/或打开了物品栏/其他功能窗口/处于暂停界面/网络卡顿或开启了分屏/切换至其他窗口。您的请求已暂存，并在${individualpreferences.get("preferences")[getIFromPref(origin.uuid)].requestavailable/1000}内有效。您可以提醒${target.name}输入/tpa accept接受，或重新发送请求。`);
                cachedrequests.unshift({origin:origin,target:target,type:type,time:new Date().getTime()})
            }			
        })		
    }
    if(type=="tpahere"){
        fm.setContent(`${origin.name}希望将您传送至他那里。`)
        target.sendForm(fm,function(player,id){
            if(origin.uuid==null){
                target.tell("找不到发起请求的玩家，他可能已经下线了。")
                return;
            }
            switch (id) {
                case 0: {
                    fixTeleport(target,origin.pos)
                    //弹窗接受的tpahere
                    if (toooften(origin)) {
                        economy.reduce(origin, conf.get("frequency_limit").limit_price);//频繁价格
                    }
                    requestshistory.unshift({ origin: origin, target: target, type: type, time: new Date().getTime() });
                    economy.reduce(origin, conf.get("economy").price);
                    break;
                }
                case 1:origin.tell(`${target.name}拒绝了您的请求`);break;
                case 2:{
                    cachedrequests.unshift({origin:origin,target:target,type:type,time:new Date().getTime()});
                    target.tell(`您已成功缓存了此请求。之后的${individualpreferences.get("preferences")[getIFromPref(origin.uuid)].requestavailable/1000}内，输入/tpa accept来接受此请求，输入/tpa deny来拒绝此请求`)
                    break;
                }
                default:{
                    origin.tell(`${target.name}设置了弹窗提醒，但弹窗未成功发送。这可能是因为${target.name}关闭了弹窗/或打开了物品栏/其他功能窗口/处于暂停界面/网络卡顿或开启了分屏/切换至其他窗口。您的请求已暂存，并在${individualpreferences.get("preferences")[getIFromPref(origin.uuid)].requestavailable/1000}内有效。您可以提醒${target.name}输入/tpa accept接受，或重新发送请求。`);
                    cachedrequests.unshift({origin:origin,target:target,type:type,time:new Date().getTime()})
                }
            }
        })
    }
}

/**
 * 向指定玩家发送选择tpa请求的表单
 * @param {Player} player 要发送表单的目标玩家
 */
function sendRequestsForm(player){
    /**
     * @param {Array<Request>} availableRequests 对于这个玩家目前可用的请求列表
     */
    let availableRequests=[]
    cachedrequests.forEach((currentValue)=>{//生成availableRequests
        if(currentValue.origin.uuid!=null){
            if(currentValue.target.uuid==player.uuid && new Date().getTime()-currentValue.time<=individualpreferences.get("preferences")[getIFromPref(currentValue.origin.uuid)].requestavailable){
                availableRequests.push(currentValue);
            }
        }
    })	
    let fm=mc.newSimpleForm();
    //生成并发送表单部分
    fm.setTitle("选择一个请求")
    fm.setContent("选择一个请求，并决定是否接受")
    availableRequests.forEach((currentValue)=>{
        fm.addButton("类型:"+currentValue.type+" 发起者:"+currentValue.origin.name+"\n"+(individualpreferences.get("preferences")[getIFromPref(currentValue.origin.uuid)].requestavailable-(new Date().getTime()-currentValue.time))/1000+"秒内有效");
        
    })
    player.sendForm(fm,(player,id)=>{
        if(id==null){return;}
        let chosenRequest=availableRequests[id]
        if(chosenRequest.origin.uuid==null){
            player.tell("没有找到请求发起者，该玩家可能已经下线。")
            return;
        }
        if(chosenRequest.target.uuid==player.uuid&&new Date().getTime()-chosenRequest.time<=individualpreferences.get("preferences")[getIFromPref(chosenRequest.origin.uuid)].requestavailable){
            let fm1=mc.newSimpleForm()
            fm1.setTitle(" ")
            fm1.setContent("对玩家"+chosenRequest.origin.name+"向您发起的"+chosenRequest.type+"请求")
            fm1.addButton("接受")
            fm1.addButton("拒绝")
            fm1.addButton("搁置")
            fm1.addButton("丢弃")
            player.sendForm(fm1,(player,id)=>{
                if(chosenRequest.origin.uuid==null){player.tell("没有找到请求发起者，该玩家可能已经下线。");return;}
                switch(id){
                    case 0:{
                        //这个缓存的请求是tpa还是tpahere
                        if(chosenRequest.type=="tpa"){
                            fixTeleport(chosenRequest.origin,chosenRequest.target.pos)
                        }else if(chosenRequest.type=="tpahere"){
                            fixTeleport(chosenRequest.target,chosenRequest.origin.pos)
                        }
                        if (toooften(chosenRequest.origin)) {
                            economy.reduce(chosenRequest.origin, conf.get("frequency_limit").limit_price);//频繁价格
                        }				
                        economy.reduce(chosenRequest.origin, conf.get("economy").price);//基础价格
                        requestDone(chosenRequest)		
                        break;	
                    }
                    case 1:{
                        chosenRequest.origin.tell(chosenRequest.target.name+"拒绝了您的"+chosenRequest.type+"请求")
                        removeRequest(chosenRequest);
                        break;
                    }
                    case 2:{
                        break;
                    }
                    case 3:{
                        removeRequest(chosenRequest)
                    }
                }
            })

        }
        else{
            player.tell("该请求已过期。")
        }
    })
}
