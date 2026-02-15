/**
 * PokerMind Arena - 合约部署脚本
 */

const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying GameVerifier...\n");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "MON\n");
  
  if (balance === 0n) {
    console.error("❌ Error: Account has no balance!");
    console.log("👉 Get testnet tokens from: https://faucet.monad.xyz");
    process.exit(1);
  }
  
  console.log("📦 Deploying GameVerifier...");
  const GameVerifier = await hre.ethers.getContractFactory("GameVerifier");
  const verifier = await GameVerifier.deploy();
  
  await verifier.waitForDeployment();
  
  const address = await verifier.getAddress();
  console.log("\n✅ GameVerifier deployed to:", address);
  
  const owner = await verifier.owner();
  const gameCount = await verifier.getGameCount();
  
  console.log("\n📋 Deployment Summary:");
  console.log("─".repeat(50));
  console.log("Contract Address:", address);
  console.log("Owner:", owner);
  console.log("Initial Game Count:", gameCount.toString());
  console.log("─".repeat(50));
  
  console.log("\n📝 Add to your .env file:");
  console.log(`GAME_VERIFIER_ADDRESS=${address}`);
  
  console.log("\n🔗 View on Explorer:");
  console.log(`https://explorer.monad.xyz/address/${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });