require('dotenv').config()
const Web3 = require('web3')
const { ChainId, Fetcher, WETH, Route, Trade, TokenAmount, TradeType, Percent } = require('@uniswap/sdk')
const ethers = require('ethers')
const fs = require('fs')
//const assert = require('assert');

let divider = "\n------------------------------------------------------\n"

const chainId = ChainId.MAINNET

let web3HD
let token
let route
let weth
let provider
let signer
let uniswap

const ACCOUNT = process.env.REACT_APP_ACCOUNT
const TOKEN_ADDRESS = process.env.REACT_APP_TOKEN_ADDRESS
const EXCHANGE_ADDRESS = process.env.REACT_APP_EXCHANGE_ADDRESS
const ETH_AMOUNT = process.env.REACT_APP_ETH_AMOUNT

const web3 = new Web3(process.env.REACT_APP_RPC_URL_WSS)
web3HD = new Web3(new Web3.providers.HttpProvider(process.env.REACT_APP_RPC_URL))
provider = new ethers.getDefaultProvider(process.env.REACT_APP_RPC_URL)
const privateKey = new Buffer.from(process.env.REACT_APP_PRIVATE_KEY, "hex");
signer = new ethers.Wallet(privateKey, provider)

// declare the token contract interfaces
tokenContract = new ethers.Contract(
  TOKEN_ADDRESS,
  ['function balanceOf(address owner) external view returns (uint)',
      'function decimals() external view returns (uint8)',
      'function approve(address spender, uint value) external returns (bool)'],
  signer
);

// declare the Uniswap contract interface
uniswap = new ethers.Contract(
  EXCHANGE_ADDRESS,
  ['function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
    'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)'],
  signer
);

let addtrxflag = false
let trxflag = false
let initialTokenBalance
let tokenBalanceAfterBuy
let tokensToSell

async function run(){

  console.log('\x1b[1m\x1b[37m[Bot]: Process has been started! \x1b[1m\x1b[31m(to stop press CTRL+C anytime)\x1b[0m\n')
  console.log('\x1b[1m\x1b[37m[Bot]: Looking for targets at DEX...\x1b[0m\n')

  fs.writeFile('./transactions_hashes.txt', '', function(){console.log('\x1b[1m\x1b[37m[Bot]: transactions_hashes.txt \x1b[1m\x1b[32mwiped!\n\x1b[0m\n\n')})

  token = await Fetcher.fetchTokenData(chainId, TOKEN_ADDRESS)
  weth = WETH[chainId]
  const pair = await Fetcher.fetchPairData(token, weth, provider)
  route = new Route([pair], weth)

  initialTokenBalance = await tokenContract.balanceOf(ACCOUNT);
  
  if(true){
    subscription = web3.eth.subscribe('pendingTransactions', function (error, result) {})
        .on("data", function (transactionHash) {
            web3.eth.getTransaction(transactionHash)
              .then(function (transaction) {
                if(transaction && !trxflag){
                  parseTransactionData(transaction)
                }
              })
            .catch(function () {
              console.log("\x1b[1m\x1b[Bot]: WARNING! Promise error caught!\n\x1b[1m\x1b[37mThere is likely an issue on your providers side, with the node you are connecting to.\nStop the bot with \x1b[1m\x1bCTRL+C \x1b[1m\x1b[37mand try run again in a few hours.");
            //.catch((error) => {
            //  assert.isNotOk(error,'Promise error')
            })
        });

    async function parseTransactionData(transactionDetails) {
      if(transactionDetails.input){

		fs.appendFileSync('transactions_hashes.txt', 'Trx hash : ' + transactionDetails.hash.toString() + '\r\n')
        const transactionInput = transactionDetails.input

        var path = 'transactions_hashes.txt';
        var text = fs.readFileSync(path).toString();
        var lines = text.split('\n');
        var newlines_count = lines.length - 1;
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`\x1b[1m\x1b[37m[Bot]: Sweeping transaction hashes... \x1b[1m\x1b[32m${newlines_count}\x1b[37m passes. `);

        if((transactionInput.length - 10) % 64 === 0){
          const toTrx = transactionDetails.to
          if(toTrx.toLowerCase() === EXCHANGE_ADDRESS.toLowerCase()
          && parseFloat(web3.utils.fromWei(transactionDetails.value, 'ether')) >= parseFloat(process.env.REACT_APP_TARGET_ETH_AMOUNT)){
          }
            if(addtrxflag){
              const exeTrxs = await executeTrxs(transactionDetails)            
              subscription.unsubscribe(function (error, success) {
                if (success)
                  console.log('\n\x1b[1m\x1b[37m[Bot]: Process has been ended!\x1b[0m');
                  console.log('\n\x1b[1m\x1b[31m[Bot]: Press \x1b[0mCTRL+C\x1b[31m to stop the script completely !\x1b[0m');
              });
            }
          }
        }
      }
    }
  }
}

async function executeTrxs(transactionDetails){
  if(trxflag){
    return
  }
  trxflag = true

  console.table([{
    'Transaction Hash': transactionDetails['hash'],
    'Observations': 'Valid Transaction',
    'Timestamp': Date.now()
  }])
  console.log(divider)
  console.log('\n\x1b[1m\x1b[37m[Bot]: Transaction spotted! - \x1b[32m', transactionDetails, "\x1b[0m\n");

  const buy = await buyTokens(transactionDetails)
  const sell = await sellTokens(transactionDetails)  
}

async function sellTokens(transactionDetails){
  const amountIn = tokensToSell

  if (amountIn.toString() !== '0'){
    const gasPrice = transactionDetails.gasPrice
    const newGasPrice = Math.floor(parseInt(gasPrice) - parseInt(1))
    const gasLimit = Math.floor(transactionDetails.gas * 1.3)

    const amountInHex = ethers.BigNumber.from(amountIn.toString()).toHexString();
    const ethAmount = ethers.utils.parseEther(ETH_AMOUNT);
    const amountOutMin = Math.floor(ethAmount * 0.01);
    const amountOutMinHex = ethers.BigNumber.from(amountOutMin.toString()).toHexString();
    const path = [token.address, weth.address];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const deadlineHex = ethers.BigNumber.from(deadline.toString()).toHexString();
  
    const nonceCount = await web3.eth.getTransactionCount(ACCOUNT)
    
    const tx = await uniswap.swapExactTokensForETH(
      amountInHex,
      amountOutMinHex,
      path,
      ACCOUNT,
      deadlineHex,
      { 
        nonce: nonceCount + 1,
        gasPrice: ethers.BigNumber.from(newGasPrice).toHexString(),
        gasLimit: ethers.BigNumber.from(gasLimit).toHexString()
      }
    );
    console.log('\x1b[1m\x1b[37m[Bot]: Your sell transaction was: \x1b[1m\x1b[32m', tx.hash, "\x1b[0m");
  }
}


async function buyTokens(transactionDetails){
  if(true){
    const gasPrice = transactionDetails.gasPrice
    const newGasPrice = Math.floor(parseInt(gasPrice) + parseInt(1))
    const gasLimit = Math.floor(transactionDetails.gas * 1.2)
    
    const inputEth = parseFloat(ETH_AMOUNT) * 0.99;
    const ethAmount = ethers.utils.parseEther(inputEth.toString());
    const trade = new Trade(route, new TokenAmount(weth, ethAmount), TradeType.EXACT_INPUT);
    const path = [weth.address, token.address];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const deadlineHex = ethers.BigNumber.from(deadline.toString()).toHexString();

    tokensToSell = trade.outputAmount.raw
    const amountOutHex = ethers.BigNumber.from(tokensToSell.toString()).toHexString();
    
    const ethAmt = parseFloat(ETH_AMOUNT) * 1.2;
    const amountInMax = ethers.utils.parseEther(ethAmt.toString());
    const amountInMaxHex = ethers.BigNumber.from(amountInMax.toString()).toHexString();
   
    const tx = await uniswap.swapETHForExactTokens(
      amountOutHex,
      path,
      ACCOUNT,
      deadlineHex,
      { 
        value: amountInMaxHex, 
        gasPrice: ethers.BigNumber.from(newGasPrice).toHexString(),
        gasLimit: ethers.BigNumber.from(gasLimit).toHexString()
      }
    );
    console.log('\x1b[1m\x1b[37m[Bot]: Your purchase transaction was: \x1b[1m\x1b[32m', tx.hash, "\x1b[0m");
  }
}

console.clear()
console.log("\n")


console.log(divider)

run()
