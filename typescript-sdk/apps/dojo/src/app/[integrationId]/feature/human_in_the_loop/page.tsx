"use client";
import React, { useState, useEffect } from "react";
import "@copilotkit/react-ui/styles.css";
import "./style.css";
import { CopilotKit, useCopilotAction, useLangGraphInterrupt } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";

interface HumanInTheLoopProps {
  params: Promise<{
    integrationId: string;
  }>;
}

const HumanInTheLoop: React.FC<HumanInTheLoopProps> = ({ params }) => {
  const { integrationId } = React.use(params);

  return (
    <CopilotKit
      runtimeUrl={`/api/copilotkit/${integrationId}`}
      showDevConsole={false}
      // agent lock to the relevant agent
      agent="human_in_the_loop"
    >
      <Chat />
    </CopilotKit>
  );
};

interface Step {
  description: string;
  status: "disabled" | "enabled" | "executing";
}
const InterruptHumanInTheLoop: React.FC<{
  event: { value: { steps: Step[] } };
  resolve: (value: string) => void;
}> = ({ event, resolve }) => {
  // Ensure we have valid steps data
  let initialSteps: Step[] = [];
  if (event.value && event.value.steps && Array.isArray(event.value.steps)) {
    initialSteps = event.value.steps.map((step: any) => ({
      description: typeof step === "string" ? step : step.description || "",
      status: typeof step === "object" && step.status ? step.status : "enabled",
    }));
  }

  const [localSteps, setLocalSteps] = useState<Step[]>(initialSteps);

  const handleCheckboxChange = (index: number) => {
    setLocalSteps((prevSteps) =>
      prevSteps.map((step, i) =>
        i === index
          ? {
              ...step,
              status: step.status === "enabled" ? "disabled" : "enabled",
            }
          : step,
      ),
    );
  };

  return (
    <div className="flex flex-col gap-4 w-[500px] bg-gray-100 rounded-lg p-8 mb-4">
      <div className="text-black space-y-2">
        <h2 className="text-lg font-bold mb-4">Select Steps</h2>
        {localSteps.map((step, index) => (
          <div key={index} className="text-sm flex items-center">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={step.status === "enabled"}
                onChange={() => handleCheckboxChange(index)}
                className="mr-2"
              />
              <span className={step.status !== "enabled" ? "line-through" : ""}>
                {step.description}
              </span>
            </label>
          </div>
        ))}
        <button
          className="mt-4 bg-gradient-to-r from-purple-400 to-purple-600 text-white py-2 px-4 rounded cursor-pointer w-48 font-bold"
          onClick={() => {
            const selectedSteps = localSteps
              .filter((step) => step.status === "enabled")
              .map((step) => step.description);
            resolve("The user selected the following steps: " + selectedSteps.join(", "));
          }}
        >
          ✨ Perform Steps
        </button>
      </div>
    </div>
  );
};

const Chat = () => {
  useLangGraphInterrupt({
    render: ({ event, resolve }) => <InterruptHumanInTheLoop event={event} resolve={resolve} />,
  });
  useCopilotAction({
    name: "generate_task_steps",
    description: "Generates a list of steps for the user to perform",
    parameters: [
      {
        name: "steps",
        type: "object[]",
        attributes: [
          {
            name: "description",
            type: "string",
          },
          {
            name: "status",
            type: "string",
            enum: ["enabled", "disabled", "executing"],
          },
        ],
      },
    ],
    renderAndWaitForResponse: ({ args, respond, status }) => {
      return <StepsFeedback args={args} respond={respond} status={status} />;
    },
  });

  return (
    <div className="flex justify-center items-center h-full w-full">
      <div className="w-8/10 h-8/10 rounded-lg">
        <CopilotChat
          className="h-full rounded-2xl"
          labels={{
            initial:
              "Hi, I'm an agent specialized in helping you with your tasks. How can I help you?",
          }}
        />
      </div>
    </div>
  );
};

const StepsFeedback = ({ args, respond, status }: { args: any; respond: any; status: any }) => {
  const [localSteps, setLocalSteps] = useState<
    {
      description: string;
      status: "disabled" | "enabled" | "executing";
    }[]
  >([]);
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === "executing" && localSteps.length === 0) {
      setLocalSteps(args.steps);
    }
  }, [status, args.steps, localSteps]);

  if (args.steps === undefined || args.steps.length === 0) {
    return <></>;
  }

  const steps = localSteps.length > 0 ? localSteps : args.steps;

  const handleCheckboxChange = (index: number) => {
    setLocalSteps((prevSteps) =>
      prevSteps.map((step, i) =>
        i === index
          ? {
              ...step,
              status: step.status === "enabled" ? "disabled" : "enabled",
            }
          : step,
      ),
    );
  };

  return (
    <div className="flex flex-col gap-4 w-[500px] bg-gray-100 rounded-lg p-8 mb-4">
      <div className=" text-black space-y-2">
        <h2 className="text-lg font-bold mb-4">Select Steps</h2>
        {steps.map((step: any, index: any) => (
          <div key={index} className="text-sm flex items-center">
            <input
              type="checkbox"
              checked={step.status === "enabled"}
              onChange={() => handleCheckboxChange(index)}
              className="mr-2"
            />
            <span
              className={step.status !== "enabled" && status != "inProgress" ? "line-through" : ""}
            >
              {step.description}
            </span>
          </div>
        ))}
      </div>
      {accepted === null && (
        <div className="flex justify-end space-x-4">
          <button
            className={`bg-gray-200 text-black py-2 px-4 rounded disabled:opacity-50 ${
              status === "executing" ? "cursor-pointer" : "cursor-default"
            }`}
            disabled={status !== "executing"}
            onClick={() => {
              if (respond) {
                setAccepted(false);
                respond({ accepted: false });
              }
            }}
          >
            Reject
          </button>
          <button
            className={`bg-black text-white py-2 px-4 rounded disabled:opacity-50 ${
              status === "executing" ? "cursor-pointer" : "cursor-default"
            }`}
            disabled={status !== "executing"}
            onClick={() => {
              if (respond) {
                setAccepted(true);
                respond({ accepted: true, steps: localSteps.filter(step => step.status === "enabled")});
              }
            }}
          >
            Confirm
          </button>
        </div>
      )}
      {accepted !== null && (
        <div className="flex justify-end">
          <div className="mt-4 bg-gray-200 text-black py-2 px-4 rounded inline-block">
            {accepted ? "✓ Accepted" : "✗ Rejected"}
          </div>
        </div>
      )}
    </div>
  );
};

function Spinner() {
  return (
    <svg
      className="mr-2 size-3 animate-spin text-slate-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
}
export default HumanInTheLoop;
