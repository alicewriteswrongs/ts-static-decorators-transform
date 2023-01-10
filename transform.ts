import ts from "typescript";
import fs from "fs";

/**
 * A transformer which manually transforms and removes decorated class fields
 * to maintain compatibility with the way that we handle custom decorators in
 * Stencil.
 */
const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
  return (sourceFile) => {
    // We'll collect calls to the TypeScript `__decorate` helper function here
    const decoratorCalls: ts.Expression[] = [];

    /**
     * Our visitor to traverse the syntax tree. we add a call to the
     * `__decorate` helper whenever we encounter a class field which is
     * decorated, and we also ensure that only undecorated class fields stick
     * around.
     */
    const decorateHelperVisitor = (node: ts.Node): ts.Node => {
      if (ts.isClassDeclaration(node)) {
        const newMembers: ts.ClassElement[] = [];

        for (let member of node.members) {
          if (ts.isPropertyDeclaration(member)) {
            const declarationName = ts.getNameOfDeclaration(member)!;

            const memberName =
              declarationName.kind === ts.SyntaxKind.ComputedPropertyName
                ? declarationName.expression.getText()
                : declarationName.getText();

            let decorators = ts.getDecorators(member)!;

            // if we find one or more decorators applied to the member, we need
            // to use TypeScript's decorator-related emit helpers to implement
            // the functionality that the decorator should have
            if (decorators.length > 0) {
              // @ts-ignore: TypeScript exports this function but it isn't included in the type defs :/
              const helpers = ts.createEmitHelperFactory(context);

              decoratorCalls.push(
                // This will create a call to the `__decorate` helper that looks like this:
                //
                // ```ts
                // __decorate([
                //     MyDecorator()
                // ], MyComponent.prototype, "decoratedProp");
                // ```
                //
                // See here for TypeScript's usage of this function to
                // implement support for 'legacy decorators':
                // https://github.com/microsoft/TypeScript/blob/2082ef2e3fcc8916cb1ed1188006a3c77854ffad/src/compiler/transformers/legacyDecorators.ts#L545-L606
                helpers.createDecorateHelper(
                  decorators.map((decorator) => decorator.expression),
                  ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier(node.name!.getText()),
                    ts.factory.createIdentifier("prototype")
                  ),
                  ts.factory.createStringLiteral(memberName)
                )
              );
            } else {
              newMembers.push(member);
            }
          }
        }

        return ts.factory.updateClassDeclaration(
          node,
          ts.getModifiers(node),
          node.name,
          node.typeParameters,
          node.heritageClauses,
          newMembers
        );
      }
      return ts.visitEachChild(node, decorateHelperVisitor, context);
    };

    // we visit the sourceFile node, traversing the tree to create calls to the
    // `__decorate` helper and remove decorated fields from class declarations
    const withHelperSourceFile = ts.visitNode(
      sourceFile,
      decorateHelperVisitor
    );

    return ts.factory.updateSourceFile(withHelperSourceFile, [
      ...withHelperSourceFile.statements,
      // we populated this above when we were walking the syntax tree. it
      // contains any calls to the `__decorate` helper which will be necessary
      // to call a user-supplied decorator function with the proper arguments.
      ...decoratorCalls.map((expr) =>
        ts.factory.createExpressionStatement(expr)
      ),
    ]);
  };
};

// reading and printing and whatnot

const underlinedLog = (str: string) => {
  console.log(str)
  console.log(Array(str.split("").length + 1).join('-'))
}

const source = String(fs.readFileSync("./source.ts"));

underlinedLog('Decorator transformation proof-of-concept')
console.log('');

underlinedLog('First, the original source:')
console.log(source);

const output = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
  },
  transformers: {
    before: [transformer],
  },
});

underlinedLog('And the transformed output:')
console.log(output.outputText);
