variable "repo" {
  description = "GitHub repository slug (e.g. AminAlAit/qgi-frontend). The runner registers to this single repo."
  type        = string
}

variable "runner_label" {
  description = "Custom label the runner advertises (e.g. qgi-frontend). Workflows match via `runs-on: [self-hosted, <label>]`. MUST exactly match the label string used by every workflow that targets this runner."
  type        = string
}

variable "runner_pat_secret_name" {
  description = "AWS Secrets Manager secret name holding the fine-grained PAT used by cloud-init to mint a short-lived runner-registration token. The secret value is a plain string."
  type        = string
}

variable "subnet_id" {
  description = "VPC subnet (private preferred — outbound NAT to GitHub + S3 is sufficient)."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for the runner security group."
  type        = string
}

variable "instance_type" {
  description = "Spot Graviton instance type. Default sized for the workload (git + s3 sync + gh CLI; CPU-light, network-bound)."
  type        = string
  default     = "c7g.medium"
}

variable "spot_max_price" {
  description = "Maximum Spot price per instance-hour. Leave empty for the on-demand-equivalent cap."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Standard QGI tags applied to all created resources."
  type        = map(string)
  default     = {}
}

variable "name_prefix" {
  description = "Prefix for created resource names. Defaults to a deterministic value derived from `runner_label`."
  type        = string
  default     = ""
}
