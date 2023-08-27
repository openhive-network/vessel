# Vessel - Hive Desktop Wallet

Vessel is a lite wallet for the Hive blockchain that you can run on your desktop computer without needing to run the blockchain itself.

**This is experimental and messy software at the moment, please use with caution.**

# Release Instructions

To build for release:

```
#Install Wine if you want to build for windows
sudo dpkg --add-architecture i386
wget -nc https://dl.winehq.org/wine-builds/winehq.key
sudo apt-key add winehq.key
sudo add-apt-repository 'deb https://dl.winehq.org/wine-builds/ubuntu/ focal main'
sudo apt update
sudo apt install --install-recommends winehq-stable

npm run build
sudo npm i -g electron-builder
electron-builder -mwl
```

Mac releases must be built on a Mac. Can build on intel for M1 thanks to Rosetta.



## No Support & No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.

## Updates

### 1.0.3 Release

- Added new Binance address with warning notes.

### 1.0.2 Release

- Added Gate.io exchange
- Removed automatic setting of liquid/savings target when choosing `same_account`
- Reduced columns of the confirmation modal on the `Send` page


### 1.0.1 Release

- Added Conversion (HBD => HIVE) and Collateralized Conversion (HIVE => HBD)
- Improved `Send` page to make it easier to deposit to/withdraw from savings

### 1.0.0 Release

- Converted to community owned project
- Fixed Binance & other exchanges not taking correctly saved memo
- Added Binance memo to settings and switched order between HBD => HIVE to HIVE => HBD

### Before

- [2017/12/09 - 0.2.0 Release Notes](https://hive.blog/vessel/@jesta/vessel-0-2-0-interact-with-steem-securely-from-any-website)
- [2017/11/29 - 0.0.9 Release Notes](https://hive.blog/vessel/@jesta/vessel-009-witness-voting-improved-delegation-controls-auths-and-customjson-ops)
- [2017/10/19 - 0.0.8 Release Notes](https://hive.blog/steem-project/@jesta/vessel-008-configurable-steem-node-new-default-node)
- [2017/09/19 - 0.0.7 Release Notes](https://hive.blog/steem-project/@jesta/vessel-007-account-creation-encrypted-memos-bittrex)
- [2017/05/24 - 0.0.6 Release Notes](https://hive.blog/steem-project/@jesta/vessel-006-steem-power-delegation)
- [2017/05/20 - This app was announced on hive.blog](https://hive.blog/steem-project/@jesta/vessel-pre-release-looking-for-feedback)




