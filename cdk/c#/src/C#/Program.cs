using Amazon.CDK;

namespace TheLambdaPowerTuner
{
    sealed class Program
    {
        public static void Main(string[] args)
        {
            var app = new App();
            new TheLambdaPowerTunerStack(app, "TheLambdaPowerTunerStack", new StackProps());
            app.Synth();
        }
    }
}
