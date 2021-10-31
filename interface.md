# Interface dependencies

## The problem

Once you write a basic interface, there is usually a need to extend it with new functionality based upon said interface. Putting these functions inside the interface causes it to bloat. Creating an extended interface does the same thing - it is hard to tell what is actually essential and what is not. Another solution is to use functions that take an interface instance on the spot(where you need to call them), but that means that use case may bring some implicit rules, which are not present in its dependency type. Finally, the fourth solution is to use singular helper functions dependent on interface and then using their types to fill the dependencies. The main problem(is this a really a problem?) with this would be potentially mixing base api with helpers in the dependencies.

The main goal is to shift all the responsibility of creating the base interface, as well as functions based on this interface to the user, so as to retain flexibility(so you don't have to force user to implement the whole interface with all its helpers to mock or test the code).

## Pattern

Write a minimal interface that represents one ability or entity.

If you need convenience functions, which only depend on the base interface, write them outside and export their types. Use cases can now depend on the convenience functions, which can be created with or without interface dependence.

Use case should not inforce any additional constraints - i.e. it should not create convenience functions or wrappers over the interface. 

Use case should only work with parameters, not dependencies(except for simply calling/using them with parameters). If there is a need to manage dependencies, you can always make a convenience wrapper(maybe it is also a pattern? What would you call it?).

The typical scenario should look like this:

Use case(params and logic) -> Deps wrapper(deps management - resolve dependencies until top-level) -> Implementation(pass top-level dependencies and parameters).

Deps wrapper should deal with implementation dependencies, not "core" or external dependencies. These should be filled in at the last step. In my case, the "core" dependencies are binance api controllers and more broadly, stuff that depends on binance http and socket clients.
