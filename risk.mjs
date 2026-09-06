export function evaluate({prices, portfolioValue, positionValue, cash, amount, ageHours, eventsVerified=false, leveraged=false}) {
 const reasons=[];
 for(const x of [portfolioValue,positionValue,cash,amount,ageHours]) if(!Number.isFinite(x)||x<0) return {decision:'BLOCKED',reasons:['Invalid or missing numeric inputs.']};
 if(portfolioValue<=0 || amount<=0) reasons.push('Portfolio value and proposed amount must be positive.');
 if(!Array.isArray(prices)||prices.length<50||prices.some(x=>!Number.isFinite(x)||x<=0)) return {decision:'BLOCKED',reasons:[...reasons,'At least 50 valid closing prices are required.']};
 const sma20=prices.slice(-20).reduce((a,b)=>a+b,0)/20;
 const sma50=prices.slice(-50).reduce((a,b)=>a+b,0)/50;
 const changes=prices.slice(-15).slice(1).map((p,i)=>p-prices.slice(-15)[i]);
 const gain=changes.reduce((a,x)=>a+Math.max(x,0),0)/14;
 const loss=changes.reduce((a,x)=>a+Math.max(-x,0),0)/14;
 const rsi14=loss===0?(gain===0?50:100):100-100/(1+gain/loss);
 if(ageHours>24) reasons.push('Market data exceeds the 24-hour freshness limit.');
 if(!eventsVerified) reasons.push('Earnings, news, filings and macro-event coverage is not verified.');
 if(leveraged) reasons.push('Leverage and short positions are excluded.');
 if(amount>10) reasons.push('Daily proposal limit is USD 10.');
 if(amount>cash) reasons.push('Insufficient available cash.');
 if(portfolioValue>0&&(positionValue+amount)/portfolioValue>0.10) reasons.push('Proposed position exceeds 10% of portfolio equity.');
 if(rsi14>70) reasons.push('RSI exceeds 70.');
 if(sma20<=sma50) reasons.push('20-day average does not exceed 50-day average.');
 return {decision:reasons.length?'WAIT':'REVIEW',reasons:reasons.length?reasons:['Trend and configured risk checks pass; manual review remains required.'],indicators:{sma20,sma50,rsi14},rulesVersion:'1',executionEnabled:false};
}
