const MyDecorator = () => {
  return (target: Object, propertyKey: string) => {
    console.log({target, propertyKey});
  };
};

export class MyComponent {
  @MyDecorator()
  decoratedProp = 3;
}
