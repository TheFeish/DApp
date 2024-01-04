var Ordering = artifacts.require("./Ordering.sol");

module.exports = function(deployer, network, accounts){
  deployer.deploy(Ordering, accounts[1]);
};