/**
 * Seed data: Top KOL (Key Opinion Leader) wallets from kolscan.io
 * These populate the initial SolCity so there's a city to explore on launch.
 */

export interface KolWallet {
  address: string;
  name: string;
  rank: number;
}

export const KOL_WALLETS: KolWallet[] = [
  { rank: 1,  name: "Cented",      address: "CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o" },
  { rank: 2,  name: "Cowboy",      address: "6EDaVsS6enYgJ81tmhEkiKFcb4HuzPUVFZeom6PHUqN3" },
  { rank: 3,  name: "Scharo",      address: "4sAUSQFdvWRBxR8UoLBYbw8CcXuwXWxnN8pXa4mtm5nU" },
  { rank: 4,  name: "Jijo",        address: "4BdKaxN8G6ka4GYtQQWk4G4dZRUTX2vQH9GcXdBREFUk" },
  { rank: 5,  name: "Cooker",      address: "8deJ9xeUvXSJwicYptA9mHsU2rN2pDx37KWzkDkEXhU6" },
  { rank: 6,  name: "theo",        address: "Bi4rd5FH5bYEN8scZ7wevxNZyNmKHdaBcvewdPFxYdLt" },
  { rank: 7,  name: "decu",        address: "4vw54BmAogeRV3vPKWyFet5yf8DTLcREzdSzx4rw9Ud9" },
  { rank: 8,  name: "bandit",      address: "5B79fMkcFeRTiwm7ehsZsFiKsC7m7n1Bgv9yLxPp9q2X" },
  { rank: 9,  name: "Sebastian",   address: "3BLjRcxWGtR7WRshJ3hL25U3RjWr5Ud98wMcczQqk4Ei" },
  { rank: 10, name: "Paper",       address: "FwjYcbfktK8PC2bzCrqxR6QkUPxmHFbcFGNrz3YAV7ft" },
  { rank: 11, name: "Sheep",       address: "78N177fzNJpp8pG49xDv1efYcTMSzo9tPTKEA9mAVkh2" },
  { rank: 12, name: "Zil",         address: "FSAmbD6jm6SZZQadSJeC1paX3oTtAiY9hTx1UYzVoXqj" },
  { rank: 13, name: "Silver",      address: "67Nwfi9hgwqhxGoovT2JGLU67uxfomLwQAWncjXXzU6U" },
  { rank: 14, name: "storm",       address: "Dxudj2DQ5odnqgZvUocaeWc1eYC78Q8vfmVtPpvTrRNh" },
  { rank: 15, name: "Johnson",     address: "J9TYAsWWidbrcZybmLSfrLzryANf4CgJBLdvwdGuC8MB" },
  { rank: 16, name: "sarah milady",address: "AAMnoNo3TpezKcT7ah9puLFZ4D59muEhQHJJqpX16ccg" },
  { rank: 17, name: "dv",          address: "BCagckXeMChUKrHEd6fKFA1uiWDtcmCXMsqaheLiUPJd" },
  { rank: 18, name: "Kadenox",     address: "B32QbbdDAyhvUQzjcaM5j6ZVKwjCxAwGH5Xgvb9SJqnC" },
  { rank: 19, name: "Frags",       address: "2yoJibiZUGB1gs31gvtynRTyx9vmj8VrWoQvXDDzUFHS" },
  { rank: 20, name: "Walta",       address: "39q2g5tTQn9n7KnuapzwS2smSx3NGYqBoea11tBjsGEt" },
  { rank: 21, name: "Trenchman",   address: "Hw5UKBU5k3YudnGwaykj5E8cYUidNMPuEewRRar5Xoc7" },
  { rank: 22, name: "Xanse",       address: "B9K2wTQcRDLRLhMKFyRh2hPqHrr6VKiCC9yNGpkMUXrh" },
  { rank: 23, name: "CoCo",        address: "FqojC24nUn3x6oMQC2ypBHmtH7rFAnKS6DvwsJoCMaiv" },
  { rank: 24, name: "Giann",       address: "GNrmKZCxYyNiSUsjduwwPJzhed3LATjciiKVuSGrsHEC" },
  { rank: 25, name: "clukz",       address: "G6fUXjMKPJzCY1rveAE6Qm7wy5U3vZgKDJmN1VPAdiZC" },
  { rank: 26, name: "Qavec",       address: "gangJEP5geDHjPVRhDS5dTF5e6GtRvtNogMEEVs91RV" },
  { rank: 27, name: "Fizzwick",    address: "3pcmVZ1DwKbqnjbGbeg3FycThT1AkTpGQYB96jGU6oS1" },
  { rank: 28, name: "Eddy",        address: "DuGezKLZp8UL2aQMHthoUibEC7WSbpNiKFJLTtK1QHjx" },
  { rank: 29, name: "kitty",       address: "qP3Q8d4WWsGbqkTfyA9Dr6cAD7DQoBuxPJMFTK48rWU" },
  { rank: 30, name: "Ramset",      address: "71PCu3E4JP5RDBoY6wJteqzxkKNXLyE1byg5BTAL9UtQ" },
  { rank: 31, name: "Cupsey",      address: "2fg5QD1eD7rzNNCsvnhmXFm5hqNgwTTG8p7kQ6f3rx6f" },
  { rank: 32, name: "radiance",    address: "FAicXNV5FVqtfbpn4Zccs71XcfGeyxBSGbqLDyDJZjke" },
  { rank: 33, name: "nad",         address: "363sqMFaxZgvCoGzxKjXe1BqMGYkSVoCwmghZUndXuaT" },
  { rank: 34, name: "Dex",         address: "mW4PZB45isHmnjGkLpJvjKBzVS5NXzTJ8UDyug4gTsM" },
  { rank: 35, name: "Putrick",     address: "AVjEtg2ECYKXYeqdRQXvaaAZBjfTjYuSMTR4WLhKoeQN" },
  { rank: 36, name: "Zef",         address: "EjtQrPTbcMevStBkpnjsH23NfUCMhGHusTYsHuGVQZp2" },
  { rank: 37, name: "cap",         address: "CAPn1yH4oSywsxGU456jfgTrSSUidf9jgeAnHceNUJdw" },
  { rank: 38, name: "dyor",        address: "AVmFMbuehLbCWB6sPdZGComwyrHtxJETZVktdA65j3Gq" },
  { rank: 39, name: "Qtdegen",     address: "7tiRXPM4wwBMRMYzmywRAE6jveS3gDbNyxgRrEoU6RLA" },
  { rank: 40, name: "Bastille",    address: "3kebnKw7cPdSkLRfiMEALyZJGZ4wdiSRvmoN4rD1yPzV" },
  { rank: 41, name: "SolCity",     address: "CYuayvLTYnbARMqcKM8CzKbRaqCkMri9iewBpGfUPsE6" },
];
