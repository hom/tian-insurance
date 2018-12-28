let got = require('got');
let moment = require('moment');
let Parse = require('./parse');

(async function() {
  /* 
  ** 登录获取token
  */
  let result;
  try {
    result = await got.get('https://ecard.95505.cn/front/login.do?fxGuid=d1bc4bf008b211e9922b7cd30ad3a7f8');
  } catch (error) {
		return console.error("​}catch -> error", error);
  }
  let user = JSON.parse(result.body).result;

  
  /*
  ** 获取已保存的订单
  */
 let policyList;
 try {
   policyList = await (new Parse.Query('Policy').select(['orderNo', 'status'])).find({
     useMasterKey: true
    })
  } catch (error) {
    console.error("​}catch -> error", error)
  }
  let orderNoMap = new Map(policyList.map((item) => [item.get('orderNo'), item.get('status').id]));
  
  /*
  ** 获取订单的状态
  */
 
 let status;
 try {
   status = await (new Parse.Query('Status')).find({
     useMasterKey: true,
    })
  } catch (error) {
    console.error("​}catch -> error", error);
  }
  
  await status.map(async (item) => {
    let id = item.id;
    let value = item.get('value');
    console.log(id, value);

    /*
    ** 获取最近的订单
    */
   let result;
    try {
      result = await got('https://ecard.95505.cn/api/myEcard/getOrders.do', {
        headers: {
          authorization: user.authorizationToken,
        },
        query: {
          userId: user.userId,
          userType: user.userType,
          orderType: value
        }
      })
    } catch (error) {
    	return console.error("​}catch -> error", error);
    }
    let list = JSON.parse(result.body).result;

    /*
    ** 过滤需要添加的订单
    */
    let forSaveInsurance = list.filter((l) => !orderNoMap.get(l.orderNo) || orderNoMap.get(l.orderNo) !== id);
   
    if (forSaveInsurance.length === 0) {
      console.log(moment().format('YYYY-MM-DD HH:mm:ss') + " " + item.get('name') +"订单暂无相关信息更新");
      return;
    }
    console.log(moment().format('YYYY-MM-DD HH:mm:ss') + " " + item.get('name') + "订单更新" + forSaveInsurance.length + "条信息");
    
    await forSaveInsurance.map(async (obj) => {
      let insuranceResult;
      try {
        insuranceResult = await (new Parse.Query('Insurance').contains('mealCode', obj.mealCode)).contains('productCode', obj.productCode).find({
          useMasterKey: true
        });
      } catch (error) {
        console.error("​}catch -> error", error);
      }
      let policy = new Parse.Object('Policy', {
        amount: obj.premium + '',
        insuranceNo: obj.policyNo || '',
        orderNo: obj.orderNo,
        phone: obj.applicantMobile,
        name: obj.applicantName,
        ACL: {},
        LEGO_STATUS : "",
        LEGO_PUBLISH_TAGS: ["online"],
      });
      policy.set('status', item.toPointer())
      if (insuranceResult && insuranceResult.length > 0) {
        policy.set('insurance', insuranceResult[0].toPointer());
        return policy.save(null, {
          useMasterKey: true,
        })
      }
      let insurance = await (new Parse.Object('Insurance')).save({
        name: obj.productName,
        productCode: obj.productCode,
        mealName: obj.mealName,
        mealCode: obj.mealCode,
        LEGO_STATUS: '',
        LEGO_PUBLISH_TAGS: ['online'],
      }, {
        useMasterKey: true,
      })
      
      policy.set('insurance', insurance.toPointer());
      return policy.save(null, {
        useMasterKey: true,
      })
    })
  })
})()