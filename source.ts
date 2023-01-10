const MyDecorator = () => {
  return (target: Object, propertyKey: string) => {
    console.log({target, propertyKey});
  };
};

class MyComponent {
  @MyDecorator()
  decoratedProp = 3;

  @MyDecorator()
  asecondprop = 3;
}
