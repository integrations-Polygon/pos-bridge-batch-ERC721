import fetchAbiData from "../../utils/fetchAbiData";
import config from "../../utils/config";
import { ethers } from "ethers";
import dotenv from "dotenv";
import ps from "prompt-sync";
const prompt = ps();
dotenv.config();

const pKey: any = process.env.PRIVATE_KEY_GOERLI;
const projectID = process.env.INFURA_GOERLI_PROJECT_ID;

const despositForERC721 = async () => {
    try {
        // Empty array to store user input arguments
        let tokenIds: any = [];
        console.log("\n-----------------------------------------");
        console.log("BRIDGE ERC721 TOKEN WITH METADATA PROCESS");
        console.log("-----------------------------------------\n");
        /* ---------------------------- INPUT ------------------------------ */

        const totalArgs = prompt("Enter the total number of tokenIds to batch deposit: ");
        if (!totalArgs) return console.log("Total number of argument cannot be null");
        if (totalArgs !== 0) {
            for (let i = 0; i < totalArgs; i++) {
                tokenIds[i] = prompt(`Enter your tokenId one by one [${i + 1}]: `);
                if (tokenIds[i] < 0) return console.log("Invalid tokenID");
            }
        }

        /* ---------------------------- SETUP ------------------------------ */

        /* 
            USING INFURA PROVIDER
        */
        const provider = new ethers.providers.InfuraProvider("goerli", projectID);

        /* 
            INITIALIZE SIGNER 
        */
        const signer = new ethers.Wallet(pKey, provider);

        /* ---------------------------- APPROVE ---------------------------- */

        /* 
            FETCH ROOT CHAIN MANAGER ABI DATA FROM THE EXPLORER
        */
        const rootTokenAddress = config.rootToken;
        const rootTokenABIData_response = await fetchAbiData(rootTokenAddress);
        const rootTokenABIData = await rootTokenABIData_response.json();
        const rootTokenABI = rootTokenABIData.result;

        /* 
            INITIALIZE ROOT TOKEN INSTANCE AND CONNECT WITH SIGNER
        */
        const rootTokenInstance = new ethers.Contract(rootTokenAddress, rootTokenABI, provider);
        const rootToken = rootTokenInstance.connect(signer);

        /* 
            APPROVE ERC721 PREDICATE CONTRACT 
        */
        console.log("\n-----------------------------------------");
        console.log("APPROVE - ERC721 PREDICATE PROXY CONTRACT");
        console.log("-----------------------------------------\n");
        for (let i = 0; i < totalArgs; i++) {
            let approveResponse = await rootToken.approve(config.ERC721PredicateProxy, tokenIds[i]);
            await approveResponse.wait(1); // wait for 1 block confirmation
            console.log(`Approve transaction hash for tokenId ${tokenIds[i]}: `, approveResponse.hash);
            console.log(`Transaction details: https://goerli.etherscan.io/tx/${approveResponse.hash}`);
        }
        console.log("\nTokens Approved successfully");

        /* ---------------------------- DEPOSIT ---------------------------- */

        /* 
            FETCH ROOT CHAIN MANAGER ABI DATA FROM THE EXPLORER
        */
        const rootChainManagerAddress = config.rootChainManager;
        const rootChainManagerABIData_response = await fetchAbiData(rootChainManagerAddress);
        const rootChainManagerABIData = await rootChainManagerABIData_response.json();
        const rootChainManagerABI = rootChainManagerABIData.result;

        /* 
            INITIALIZE ROOT CHAIN MAMANGER INSTANCE 
        */
        const rootChainManagerInstance = new ethers.Contract(
            rootChainManagerAddress,
            rootChainManagerABI,
            provider
        );
        const rootChainManager = rootChainManagerInstance.connect(signer);

        /* 
            ENCODE DEPOSITDATA
        */
        const abiCoder = ethers.utils.defaultAbiCoder;
        const depositData = abiCoder.encode(["uint256[]"], [tokenIds]);

        /* 
            DEPOSIT ROOT TOKEN THROUGH ROOT CHAIN MANAGER
        */
        console.log("\n-----------------------------------------");
        console.log("DEPOSIT - ROOTCHAINMANAGER PROXY CONTRACT");
        console.log("-----------------------------------------\n");

        const rootChainManagerProxy = rootChainManager.attach(config.rootChainManagerProxy);

        const depositFor_response = await rootChainManagerProxy.depositFor(
            config.user,
            config.rootToken,
            depositData
        );
        await depositFor_response.wait(1);

        console.log("Deposit transaction hash: ", depositFor_response.hash);
        console.log(`Transaction details: https://goerli.etherscan.io/tx/${depositFor_response.hash}`);
        console.log(`\nToken Deposited successfully to ERC721Predicate Contract`);
    } catch (error) {
        console.log("Error in despositForERC721", error);
        process.exit(1);
    }
};

despositForERC721()
    .then(() => {
        console.log("\n\n---------- ENDING ALL PROCESS ----------\n\n");
        process.exit(0);
    })
    .catch((error) => {
        console.error("error", error);
        process.exit(1);
    });
