# Indicators in scripts

The indicators are kept in a separate package as pure functions with no external dependencies. This package only aims to extend them with convenience wrappers(as of now, it's mostly integration with rxjs). Potentially the whole `domain` folder will be a separate package later as it isn't coupled with the concrete implementation in `binance`(DI principle - `binance` depends on `domain`).

Since the indicator functions are pure, there is no need to inject them as dependencies - they can be used directly in a script, which will then take data streams as parameters. Indicator streams themselves should not be passed to the script. Their synchronization is a part of a script logic(i.e. if the script expects several indicators to work with one data source, this restriction should be contained within it).
