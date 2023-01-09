import ts from "typescript";
import fs from "fs";

const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
  return (sourceFile) => {
    const decoratorCalls: ts.Expression[] = [];

    const visitor = (node: ts.Node): ts.Node => {
      if (ts.isClassDeclaration(node)) {
        const newMembers: ts.ClassElement[] = [];

        node.members.forEach((member) => {
          if (ts.isPropertyDeclaration(member)) {
            const declarationName = ts.getNameOfDeclaration(member)!;

            const memberName =
              declarationName.kind === ts.SyntaxKind.ComputedPropertyName
                ? declarationName.expression.getText()
                : declarationName.getText();

            let decorators = ts.getDecorators(member)!;

            if (decorators.length > 0) {
              // @ts-ignore
              const helpers = ts.createEmitHelperFactory(context);

              decoratorCalls.push(
                helpers.createDecorateHelper(
                  decorators,
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
          } else {
            newMembers.push(member);
          }
        });

        return ts.factory.updateClassDeclaration(
          node,
          node.decorators,
          ts.getModifiers(node),
          node.name,
          node.typeParameters,
          node.heritageClauses,
          newMembers
        );
      }
      return ts.visitEachChild(node, visitor, context);
    };

    const transformedSourceFile = ts.visitNode(sourceFile, visitor);

    return ts.factory.updateSourceFile(transformedSourceFile, [
      ...sourceFile.statements,
      ...decoratorCalls.map((expr) =>
        ts.factory.createExpressionStatement(expr)
      ),
    ]);
  };
};

const source = String(fs.readFileSync("./source.ts"));

const output = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
  },
  transformers: {
    before: [transformer],
  },
});

console.log(output.outputText);
